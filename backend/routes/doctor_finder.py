import logging
import os
import re
import time
from urllib.parse import quote

import requests
from flask import Blueprint, jsonify, request

doctor_finder_bp = Blueprint(
    "doctor_finder",
    __name__,
    url_prefix="/api/doctor-finder",
)

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
GOOGLE_PLACES_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()

HEADERS = {
    "User-Agent": "ElderSenseHealthcareLocator/2.5 (contact: support@eldersense.org)"
}

SPECIALITY_TERMS = {
    "cardiologist": ["cardiologist", "cardiology", "cardiac", "heart"],
    "cardiology": ["cardiologist", "cardiology", "cardiac", "heart"],
    "gynaecologist": [
        "gynaecologist", "gynecologist", "gynaecology", "gynecology",
        "maternity", "obstetrics", "women"
    ],
    "gynecologist": [
        "gynaecologist", "gynecologist", "gynaecology", "gynecology",
        "maternity", "obstetrics", "women"
    ],
    "dermatologist": ["dermatologist", "dermatology", "skin"],
    "paediatrician": [
        "paediatrician", "pediatrician", "paediatrics", "pediatrics", "child"
    ],
    "pediatrician": [
        "paediatrician", "pediatrician", "paediatrics", "pediatrics", "child"
    ],
    "neurologist": ["neurologist", "neurology", "neuro", "brain", "spine"],
    "orthopaedic": [
        "orthopaedic", "orthopedic", "orthopedics", "bone", "joint"
    ],
    "orthopedist": [
        "orthopaedic", "orthopedic", "orthopedics", "bone", "joint"
    ],
    "ophthalmologist": ["ophthalmologist", "ophthalmology", "eye", "vision"],
    "dentist": ["dentist", "dentistry", "dental", "teeth"],
    "psychiatrist": ["psychiatrist", "psychiatry", "mental health"],
    "ent": ["ent", "otolaryngology", "ear nose throat", "throat"],
    "general physician": [
        "general physician", "general practice", "general practitioner",
        "physician", "doctor", "clinic", "internal medicine"
    ],
    "oncologist": ["oncologist", "oncology", "cancer"],
    "urologist": ["urologist", "urology"],
    "endocrinologist": ["endocrinologist", "endocrinology", "diabetes"],
    "nephrologist": ["nephrologist", "nephrology", "kidney", "dialysis"],
    "pulmonologist": ["pulmonologist", "pulmonology", "chest", "lungs"],
}

SEARCH_CACHE = {}
CACHE_TTL_SECONDS = 300


def make_maps_url(query):
    return "https://www.google.com/maps/search/?api=1&query=" + quote(query)


def make_directions_url(latitude, longitude, query):
    if latitude is not None and longitude is not None:
        destination = f"{latitude},{longitude}"
    else:
        destination = query
    return "https://www.google.com/maps/dir/?api=1&destination=" + quote(destination)


def expanded_speciality_terms(speciality):
    value = (speciality or "").strip().lower()
    if not value:
        return []
    return SPECIALITY_TERMS.get(value, [value])


def matches_speciality(record, speciality):
    if not speciality:
        return True

    fields = [
        "name",
        "category",
        "type",
        "speciality",
        "services",
        "description",
        "address",
    ]

    haystack = " ".join(str(record.get(field) or "") for field in fields).lower()
    return any(term in haystack for term in expanded_speciality_terms(speciality))


def calculate_completeness_score(record):
    score = 0

    if record.get("rating") is not None and str(record.get("rating")).strip() != "":
        score += 25

    rev = record.get("review_count")
    if rev is not None and str(rev).strip() != "" and int(rev or 0) > 0:
        score += 15

    if record.get("phone") and str(record.get("phone")).strip():
        score += 15

    addr = str(record.get("address") or "")
    if addr and "not listed" not in addr.lower() and len(addr) > 12:
        score += 15

    if record.get("speciality") or record.get("services"):
        score += 10

    if record.get("opening_hours"):
        score += 10

    if record.get("website"):
        score += 5

    if record.get("qualifications") or record.get("education"):
        score += 5

    if record.get("latitude") is not None and record.get("longitude") is not None:
        score += 5

    return score


def make_address(tags, city):
    keys = [
        "addr:housenumber",
        "addr:unit",
        "addr:street",
        "addr:suburb",
        "addr:neighbourhood",
        "addr:city",
        "addr:town",
        "addr:state",
        "addr:postcode",
    ]

    parts = []
    for key in keys:
        value = tags.get(key)
        if value and value not in parts:
            parts.append(value)

    if not any(tags.get(key) for key in ("addr:city", "addr:town")):
        parts.append(city)

    return ", ".join(str(value) for value in parts if value)


def osm_url_for(element):
    kind = element.get("type")
    osm_id = element.get("id")
    if kind in ("node", "way", "relation") and osm_id:
        return f"https://www.openstreetmap.org/{kind}/{osm_id}"
    return None


def make_result(
    name,
    city,
    category="Healthcare",
    address="",
    latitude=None,
    longitude=None,
    tags=None,
    osm_url=None,
    fallback_address="",
):
    tags = tags or {}
    query = f"{name}, {city}, India"

    speciality = (
        tags.get("healthcare:speciality")
        or tags.get("healthcare_speciality")
        or tags.get("speciality")
        or tags.get("specialty")
        or ""
    )

    phone = (
        tags.get("phone")
        or tags.get("contact:phone")
        or tags.get("telephone")
        or tags.get("contact:mobile")
    )

    website = (
        tags.get("website")
        or tags.get("contact:website")
        or tags.get("url")
    )

    opening_hours = (
        tags.get("opening_hours")
        or tags.get("opening_hours:covid19")
    )

    services = (
        tags.get("healthcare:speciality")
        or tags.get("healthcare")
        or tags.get("service")
        or ""
    )

    lat_val = None
    if latitude is not None:
        try:
            lat_val = float(latitude)
        except (ValueError, TypeError):
            lat_val = None

    lon_val = None
    if longitude is not None:
        try:
            lon_val = float(longitude)
        except (ValueError, TypeError):
            lon_val = None

    return {
        "id": osm_url or f"{name}|{lat_val}|{lon_val}",
        "name": name,
        "category": str(category or "Healthcare")
            .replace("_", " ")
            .replace("-", " ")
            .title(),
        "type": (
            tags.get("amenity")
            or tags.get("healthcare")
            or category
        ),
        "speciality": speciality,
        "services": services,
        "description": tags.get("description") or "",
        "address": (
            address
            or fallback_address
            or "Address not listed"
        ),
        "phone": phone,
        "email": tags.get("email") or tags.get("contact:email"),
        "website": website,
        "opening_hours": opening_hours,
        "open_now": None,
        "rating": None,
        "review_count": None,
        "qualifications": (
            tags.get("qualification")
            or tags.get("healthcare:qualification")
        ),
        "education": tags.get("education"),
        "latitude": lat_val,
        "longitude": lon_val,
        "source": "OpenStreetMap",
        "maps_url": make_maps_url(query),
        "directions_url": make_directions_url(lat_val, lon_val, query),
        "osm_url": osm_url,
    }


def search_google_places(city, speciality=""):
    if not GOOGLE_PLACES_KEY:
        return None

    search_term = (
        f"{speciality} hospitals clinics doctors"
        if speciality
        else "hospitals clinics doctors medical centres laboratories"
    )

    field_mask = ",".join([
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.websiteUri",
        "places.regularOpeningHours",
        "places.currentOpeningHours",
        "places.primaryType",
        "places.types",
        "places.googleMapsUri",
        "nextPageToken",
    ])

    results = []
    seen = set()
    page_token = None

    for _ in range(3):
        payload = {
            "textQuery": f"{search_term} in {city}, India",
            "pageSize": 20,
            "languageCode": "en",
            "regionCode": "IN",
        }
        if page_token:
            payload["pageToken"] = page_token

        try:
            response = requests.post(
                GOOGLE_PLACES_URL,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
                    "X-Goog-FieldMask": field_mask,
                },
                timeout=25,
            )
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            logger.warning("Google Places request error: %s", e)
            break

        places_batch = data.get("places", [])
        for place in places_batch:
            display_name = place.get("displayName") or {}
            name = display_name.get("text")
            if not name:
                continue

            location = place.get("location") or {}
            latitude = location.get("latitude")
            longitude = location.get("longitude")

            primary_type = place.get("primaryType") or "healthcare"
            types = place.get("types") or []
            category = primary_type.replace("_", " ").title()

            regular_hours = place.get("regularOpeningHours") or {}
            current_hours = place.get("currentOpeningHours") or {}
            periods = regular_hours.get("weekdayDescriptions") or []

            phone = (
                place.get("nationalPhoneNumber")
                or place.get("internationalPhoneNumber")
            )

            result = {
                "id": f"google:{place.get('id', name)}",
                "name": name,
                "category": category,
                "type": ", ".join(types) or category,
                "speciality": speciality or "",
                "services": ", ".join(types),
                "description": "",
                "address": place.get("formattedAddress") or "Address not listed",
                "phone": phone,
                "email": None,
                "website": place.get("websiteUri"),
                "opening_hours": "; ".join(periods) if periods else None,
                "open_now": current_hours.get("openNow"),
                "rating": place.get("rating"),
                "review_count": place.get("userRatingCount"),
                "qualifications": None,
                "education": None,
                "latitude": latitude,
                "longitude": longitude,
                "source": "Google Places",
                "maps_url": place.get("googleMapsUri"),
                "directions_url": make_directions_url(
                    latitude, longitude, f"{name}, {city}, India"
                ),
                "osm_url": None,
            }

            key = (
                str(place.get("id") or name).lower().strip(),
                str(round(latitude, 4)) if latitude else "",
                str(round(longitude, 4)) if longitude else "",
            )

            if key not in seen:
                seen.add(key)
                results.append(result)

        page_token = data.get("nextPageToken")
        if not page_token:
            break
        time.sleep(1.2)

    return results


def search_nominatim(city, speciality=""):
    search_queries = []
    if speciality:
        for term in expanded_speciality_terms(speciality)[:3]:
            search_queries.append(f"{term} {city}")

    search_queries.extend([
        f"hospital in {city}",
        f"clinic in {city}",
        f"doctor in {city}",
        f"diagnostic centre in {city}",
        f"dental clinic in {city}",
        f"healthcare in {city}",
    ])

    results = []
    seen = set()

    for term in search_queries:
        try:
            response = requests.get(
                NOMINATIM_URL,
                params={
                    "q": term,
                    "format": "jsonv2",
                    "limit": 50,
                    "addressdetails": 1,
                    "extratags": 1,
                    "namedetails": 1,
                    "countrycodes": "in",
                },
                headers=HEADERS,
                timeout=12,
            )
            response.raise_for_status()

            for place in response.json():
                name = (
                    place.get("name")
                    or (place.get("namedetails") or {}).get("name")
                )
                if not name:
                    continue

                address_data = place.get("address") or {}
                address = ", ".join(
                    str(v)
                    for v in [
                        address_data.get("house_number"),
                        address_data.get("road"),
                        address_data.get("suburb") or address_data.get("neighbourhood"),
                        address_data.get("city") or address_data.get("town") or address_data.get("village"),
                        address_data.get("state"),
                        address_data.get("postcode"),
                    ]
                    if v
                )

                osm_type = place.get("osm_type")
                osm_id = place.get("osm_id")
                osm_url = (
                    f"https://www.openstreetmap.org/{osm_type}/{osm_id}"
                    if osm_type in ("node", "way", "relation") and osm_id
                    else None
                )

                tags = dict(place.get("extratags") or {})
                tags["amenity"] = (
                    place.get("type")
                    or place.get("class")
                    or "healthcare"
                )

                result = make_result(
                    name=name,
                    city=city,
                    category=tags["amenity"],
                    address=address,
                    latitude=place.get("lat"),
                    longitude=place.get("lon"),
                    tags=tags,
                    osm_url=osm_url,
                    fallback_address=place.get("display_name", ""),
                )

                if not matches_speciality(result, speciality):
                    continue

                lat_str = str(round(float(place.get("lat")), 4)) if place.get("lat") else ""
                lon_str = str(round(float(place.get("lon")), 4)) if place.get("lon") else ""
                key = (name.strip().lower(), lat_str, lon_str)

                if key not in seen:
                    seen.add(key)
                    results.append(result)

        except Exception as e:
            logger.warning("Nominatim query failed for '%s': %s", term, e)

    return results


def search_overpass(city, bbox, speciality=""):
    south, north, west, east = bbox
    overpass_query = f"""
    [out:json][timeout:35];
    (
      nwr["amenity"~"^(hospital|clinic|doctors|dentist|pharmacy)$"]({south},{west},{north},{east});
      nwr["healthcare"]({south},{west},{north},{east});
      nwr["medical_system"]({south},{west},{north},{east});
    );
    out center tags;
    """

    elements = None
    for server in OVERPASS_SERVERS:
        try:
            response = requests.post(
                server,
                data={"data": overpass_query},
                headers=HEADERS,
                timeout=35,
            )
            response.raise_for_status()
            elements = response.json().get("elements", [])
            if elements:
                break
        except Exception as e:
            logger.warning("Overpass server %s failure: %s", server, e)

    if not elements:
        return []

    results = []
    seen = set()

    for element in elements:
        tags = element.get("tags") or {}
        name = (
            tags.get("name")
            or tags.get("name:en")
            or tags.get("official_name")
        )
        if not name:
            continue

        lat = element.get("lat")
        lon = element.get("lon")
        if lat is None or lon is None:
            center = element.get("center") or {}
            lat = center.get("lat")
            lon = center.get("lon")

        result = make_result(
            name=name,
            city=city,
            category=(
                tags.get("amenity")
                or tags.get("healthcare")
                or "healthcare"
            ),
            address=make_address(tags, city),
            latitude=lat,
            longitude=lon,
            tags=tags,
            osm_url=osm_url_for(element),
        )

        if not matches_speciality(result, speciality):
            continue

        lat_key = str(round(float(lat), 4)) if lat is not None else ""
        lon_key = str(round(float(lon), 4)) if lon is not None else ""
        key = (name.strip().lower(), lat_key, lon_key)

        if key not in seen:
            seen.add(key)
            results.append(result)

    return results


@doctor_finder_bp.get("/search")
def search_healthcare():
    city = (request.args.get("city") or "").strip()
    speciality = (request.args.get("speciality") or "").strip()

    if not city:
        return jsonify({
            "status": "error",
            "message": "Please enter a city or locality.",
            "results": [],
            "count": 0,
        }), 400

    if len(city) > 120 or len(speciality) > 100:
        return jsonify({
            "status": "error",
            "message": "Search parameters exceed permitted length.",
            "results": [],
            "count": 0,
        }), 400

    cache_key = f"{city.lower()}|{speciality.lower()}"
    now = time.time()
    if cache_key in SEARCH_CACHE:
        cached_time, cached_data = SEARCH_CACHE[cache_key]
        if now - cached_time < CACHE_TTL_SECONDS:
            return jsonify(cached_data)

    results = []
    source = "OpenStreetMap"

    if GOOGLE_PLACES_KEY:
        try:
            google_results = search_google_places(city, speciality)
            if google_results:
                results = google_results
                source = "Google Places"
        except Exception as e:
            logger.exception("Google Places execution error for %s: %s", city, e)

    if not results:
        geocoded = None
        try:
            geo_response = requests.get(
                NOMINATIM_URL,
                params={
                    "q": f"{city}, India",
                    "format": "jsonv2",
                    "limit": 1,
                    "addressdetails": 1,
                },
                headers=HEADERS,
                timeout=12,
            )
            geo_response.raise_for_status()
            geocoded = geo_response.json()
        except Exception as e:
            logger.warning("Geocoding failed for %s: %s", city, e)

        bbox_results = []
        if geocoded and len(geocoded) > 0:
            bbox = geocoded[0].get("boundingbox")
            if bbox and len(bbox) == 4:
                try:
                    south, north, west, east = map(float, bbox)
                    lat_pad = max(0.04, abs(north - south) * 0.1)
                    lon_pad = max(0.04, abs(east - west) * 0.1)
                    expanded_bbox = (
                        south - lat_pad,
                        north + lat_pad,
                        west - lon_pad,
                        east + lon_pad,
                    )
                    bbox_results = search_overpass(city, expanded_bbox, speciality)
                except Exception as e:
                    logger.warning("Overpass processing error: %s", e)

        nominatim_results = search_nominatim(city, speciality)

        merged = []
        seen = set()

        for item in (bbox_results + nominatim_results):
            lat_str = str(round(item["latitude"], 4)) if item.get("latitude") is not None else ""
            lon_str = str(round(item["longitude"], 4)) if item.get("longitude") is not None else ""
            key = (item["name"].strip().lower(), lat_str, lon_str)

            if key not in seen:
                seen.add(key)
                merged.append(item)

        results = merged
        source = "OpenStreetMap" if results else "Unavailable"

    results.sort(
        key=lambda item: (
            calculate_completeness_score(item),
            float(item.get("rating") or 0),
            int(item.get("review_count") or 0),
        ),
        reverse=True,
    )

    message = (
        "Ratings, review counts, and verified contacts are shown where available. "
        "Independent verification before in-person visits is recommended."
        if source == "Google Places"
        else (
            "OpenStreetMap public records do not standardise star ratings or individual doctor degrees. "
            "Available verified contacts, hours, and addresses are highlighted first."
        )
    )

    response_data = {
        "status": "success",
        "source": source,
        "message": message,
        "city": city,
        "count": len(results),
        "results": results,
        "maps_url": make_maps_url(f"{speciality or 'healthcare'} in {city}, India"),
    }

    if results:
        SEARCH_CACHE[cache_key] = (now, response_data)

    return jsonify(response_data)