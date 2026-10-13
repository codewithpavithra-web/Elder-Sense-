import os
import time

import requests
from flask import Blueprint, jsonify, request
from dotenv import load_dotenv

from models import MedicineInformation, Pharmacy, PharmacyInventory

load_dotenv()

pharmacy_bp = Blueprint(
    "pharmacy",
    __name__,
    url_prefix="/api/pharmacy"
)

# =========================================================
# ANAKIN CONFIGURATION
# =========================================================

ANAKIN_API_KEY = os.getenv("ANAKIN_API_KEY")

ANAKIN_TASK_URL = "https://anakin.io/v1/wire/task"
ANAKIN_JOB_URL = "https://anakin.io/v1/wire/jobs"

ANAKIN_SYNC_URL = "https://api.anakin.io/v1/wire-run"

# Cache successful searches in memory to avoid spending credits on repeat queries.
_APOLLO_SEARCH_CACHE = {}
_APOLLO_SEARCH_CACHE_TTL_SECONDS = 180


# =========================================================
# ANAKIN HEADERS
# =========================================================

def anakin_headers():
    return {
        "X-API-Key": ANAKIN_API_KEY,
        "Content-Type": "application/json",
    }


# =========================================================
# ASYNC ANAKIN ACTION
# =========================================================

def run_anakin_action(action_id, params):

    if not ANAKIN_API_KEY:
        return {
            "success": False,
            "error": "ANAKIN_API_KEY is not configured."
        }

    try:

        payload = {
            "action_id": action_id,
            "params": params
        }

        response = requests.post(
            ANAKIN_TASK_URL,
            json=payload,
            headers=anakin_headers(),
            timeout=30
        )

        response.raise_for_status()

        task_data = response.json()

        job_id = task_data.get("job_id")

        if not job_id:
            return {
                "success": False,
                "error": "Anakin did not return a job ID."
            }

        job_url = f"{ANAKIN_JOB_URL}/{job_id}"

        for attempt in range(30):

            time.sleep(2)

            job_response = requests.get(
                job_url,
                headers=anakin_headers(),
                timeout=30
            )

            job_response.raise_for_status()

            job_data = job_response.json()

            status = job_data.get("status")

            if status == "ok":

                return {
                    "success": True,
                    "data": job_data.get("data")
                }

            if status in ["failed", "error"]:

                return {
                    "success": False,
                    "error":
                        job_data.get(
                            "error",
                            "Anakin job failed."
                        )
                }

            print(
                f"Anakin {action_id} still processing "
                f"({attempt + 1}/30)..."
            )

        return {
            "success": False,
            "error": "Anakin job timed out after 60 seconds."
        }

    except requests.RequestException as exc:

        print(
            f"Anakin {action_id} request error:",
            exc
        )

        return {
            "success": False,
            "error": str(exc)
        }

    except Exception as exc:

        print(
            f"Unexpected Anakin {action_id} error:",
            exc
        )

        return {
            "success": False,
            "error": str(exc)
        }


# =========================================================
# APOLLO LIVE SEARCH
# =========================================================

def get_apollo_live_products(
    medicine_name,
    pincode="577004"
):

    if not ANAKIN_API_KEY:

        print(
            "ANAKIN_API_KEY is not configured."
        )

        return []

    cache_key = (
        str(medicine_name or "").strip().casefold(),
        str(pincode or "").strip()
    )
    cached = _APOLLO_SEARCH_CACHE.get(cache_key)
    if cached and (time.time() - cached["saved_at"]) < _APOLLO_SEARCH_CACHE_TTL_SECONDS:
        print("Using cached Apollo search results; no Anakin request made.")
        return [dict(item) for item in cached["products"]]

    payload = {
        "action_id": "aph_search",
        "params": {
            "query": medicine_name,
            "page": 1,
            "per_page": 3,
            "sort": "relevance",
            "pincode": pincode
        }
    }

    # =====================================================
    # SYNCHRONOUS SEARCH
    # =====================================================

    try:

        print(
            "Searching Apollo Pharmacy live data..."
        )

        response = requests.post(
            ANAKIN_SYNC_URL,
            json=payload,
            headers=anakin_headers(),
            timeout=90
        )

        print(
            "Anakin synchronous status:",
            response.status_code
        )

        if response.status_code == 402:
            print(
                "Anakin returned HTTP 402 Payment Required. "
                "Check the account plan, credits, and endpoint access; "
                "regenerating the API key alone may not resolve billing restrictions."
            )
            return []

        if response.status_code == 401 or response.status_code == 403:
            print(
                f"Anakin returned HTTP {response.status_code}. "
                "Check whether the API key is valid and authorized for this action."
            )
            return []

        response.raise_for_status()

        result = response.json()

        print(
            "Anakin synchronous response received."
        )

        data = result.get("result")

        if isinstance(data, dict):

            if isinstance(
                data.get("data"),
                dict
            ):
                data = data["data"]

        if not isinstance(data, dict):

            data = result.get("data")

        if not isinstance(data, dict):

            data = result

        products = data.get("products")

        if not isinstance(products, list):

            print(
                "Apollo response did not contain products."
            )

            return []

        live_products = []

        for product in products:

            if not isinstance(product, dict):
                continue

            live_products.append({

                "id":
                    product.get("id"),

                "sku":
                    product.get("sku"),

                "name":
                    product.get("name"),

                "url_key":
                    product.get("urlKey")
                    or product.get("url_key"),

                "status":
                    product.get("availability")
                    or product.get("status"),

                "price":
                    product.get("price"),

                "special_price":
                    product.get("specialPrice")
                    or product.get("special_price"),

                "discount_percentage":
                    product.get("discount")
                    or product.get(
                        "discount_percentage"
                    ),

                "unit_size":
                    product.get("unitSize")
                    or product.get("unit_size"),

                "thumbnail":
                    product.get("thumbnail"),

                "prescription_required":
                    product.get(
                        "prescriptionRequired"
                    ),

                "delivery_time":
                    product.get(
                        "deliveryTime"
                    ),

                "moq":
                    product.get("moq"),

                "max_order_quantity":
                    product.get(
                        "maxOrderQuantity"
                    ),
            })

        print(
            "Apollo live products:",
            len(live_products)
        )

        # Cache successful results for 3 minutes. Repeat searches use no credits.
        _APOLLO_SEARCH_CACHE[cache_key] = {
            "saved_at": time.time(),
            "products": [dict(item) for item in live_products],
        }
        return live_products

    except requests.RequestException as exc:

        print(
            "Apollo synchronous search failed:",
            exc
        )

    except Exception as exc:

        print(
            "Apollo synchronous search processing error:",
            exc
        )

    return []


# =========================================================
# APOLLO PRODUCT DETAILS
# =========================================================

def get_apollo_product_info(sku):

    if not sku:

        return {
            "success": False,
            "error": "SKU missing."
        }

    if not ANAKIN_API_KEY:

        return {
            "success": False,
            "error":
                "ANAKIN_API_KEY is not configured."
        }

    payload = {
        "action_id": "aph_product_info",
        "params": {
            "sku": sku
        }
    }

    try:

        print(
            f"Fetching Apollo product details: {sku}"
        )

        response = requests.post(
            ANAKIN_SYNC_URL,
            json=payload,
            headers=anakin_headers(),
            timeout=90
        )

        print(
            f"Product info status {sku}:",
            response.status_code
        )

        # -------------------------------------------------
        # Rate limit
        # -------------------------------------------------

        if response.status_code == 429:

            print(
                f"Rate limited for {sku}. "
                "Skipping extra detail request."
            )

            return {
                "success": False,
                "sku": sku,
                "rate_limited": True
            }

        if response.status_code == 402:
            print(
                f"Anakin product details returned HTTP 402 for {sku}. "
                "Skipping extra details; check the provider plan/credits."
            )
            return {"success": False, "sku": sku, "payment_required": True}

        if response.status_code in (401, 403):
            print(
                f"Anakin product details returned HTTP {response.status_code} for {sku}; "
                "check API key authorization."
            )
            return {"success": False, "sku": sku}

        response.raise_for_status()

        result = response.json()

        data = result.get("result")

        if isinstance(data, dict):

            if isinstance(
                data.get("data"),
                dict
            ):
                data = data["data"]

        if not isinstance(data, dict):

            data = result.get("data")

        if not isinstance(data, dict):

            data = result

        product_data = data

        if isinstance(
            data.get("product"),
            dict
        ):

            product_data = data["product"]

        elif isinstance(
            data.get("productInfo"),
            dict
        ):

            product_data = data["productInfo"]

        elif isinstance(
            data.get("product_info"),
            dict
        ):

            product_data = data["product_info"]

        elif isinstance(
            data.get("data"),
            dict
        ):

            product_data = data["data"]

        if not isinstance(product_data, dict):

            return {
                "success": False,
                "sku": sku
            }

        details = {
            "success": True,

            "sku":
                product_data.get(
                    "sku"
                ) or sku,

            "quantity":
                product_data.get(
                    "quantity"
                ),

            "expiry_date":
                product_data.get(
                    "expiryDate"
                )
                or product_data.get(
                    "expiry_date"
                ),

            "price":
                product_data.get(
                    "sellingPrice"
                )
                or product_data.get(
                    "selling_price"
                )
                or product_data.get(
                    "specialPrice"
                )
                or product_data.get(
                    "special_price"
                ),

            "mrp":
                product_data.get(
                    "mrp"
                ),

            "discount":
                product_data.get(
                    "discount"
                ),

            "unit_price":
                product_data.get(
                    "unitPrice"
                )
                or product_data.get(
                    "unit_price"
                ),

            "pack_info":
                product_data.get(
                    "packInfo"
                )
                or product_data.get(
                    "pack_info"
                )
                or product_data.get(
                    "unitSize"
                )
                or product_data.get(
                    "unit_size"
                ),

            "available":
                product_data.get(
                    "available"
                ),

            "recent_purchases":
                product_data.get(
                    "recentPurchases"
                )
                or product_data.get(
                    "recent_purchases"
                ),

            "scraped_at":
                product_data.get(
                    "scrapedAt"
                )
                or product_data.get(
                    "scraped_at"
                ),
        }

        details = {
            key: value
            for key, value in details.items()
            if value is not None
        }

        print(
            f"Product details received: {sku}"
        )

        return details

    except requests.RequestException as exc:

        print(
            f"Apollo product info failed "
            f"for {sku}:",
            exc
        )

        return {
            "success": False,
            "sku": sku
        }

    except Exception as exc:

        print(
            f"Apollo product info processing error "
            f"for {sku}:",
            exc
        )

        return {
            "success": False,
            "sku": sku
        }


# =========================================================
# BUILD DETAILS FOR ALL PRODUCTS
# =========================================================

def get_all_product_details(products):
    """Build detail cards from the search response without extra API calls.

    Credit-saving mode: never invoke aph_product_info for every SKU. The
    search endpoint's values are used as-is; missing values remain missing.
    """
    detailed_products = []
    for product in products or []:
        sku = product.get("sku")
        details = {
            "success": True,
            "sku": sku,
            "available": product.get("status"),
            "price": product.get("special_price") or product.get("price"),
            "mrp": product.get("price"),
            "discount": product.get("discount_percentage"),
            "pack_info": product.get("unit_size"),
            "delivery_time": product.get("delivery_time"),
            "prescription_required": product.get("prescription_required"),
            "thumbnail": product.get("thumbnail"),
            "product_url": (
                "https://www.apollopharmacy.in/otc/" + str(product.get("url_key"))
                if product.get("url_key") else None
            ),
        }
        details = {key: value for key, value in details.items() if value is not None}
        detailed_products.append({"sku": sku, "details": details})
    return detailed_products


# =========================================================
# MEDICINE SERIALIZER
# =========================================================

def serialize_medicine(medicine):

    if not medicine:
        return None

    return {

        "id":
            medicine.id,

        "name":
            medicine.name,

        "generic_name":
            medicine.generic_name,

        "uses":
            medicine.uses,

        "dosage_information":
            medicine.dosage_information,

        "side_effects":
            medicine.side_effects,

        "precautions":
            medicine.precautions,

        "food_interactions":
            medicine.food_interactions,
    }


# =========================================================
# MEDICINE SEARCH ROUTE
# =========================================================

@pharmacy_bp.route(
    "/search",
    methods=["GET"]
)
def search_medicine():

    medicine_name = (
        request.args
        .get(
            "medicine",
            ""
        )
        .strip()
    )

    pincode = request.args.get("pincode", "").strip()
    city = request.args.get("city", "").strip()

    if not medicine_name:

        return jsonify({

            "success":
                False,

            "error":
                "Medicine name is required."

        }), 400

    try:

        # -------------------------------------------------
        # Medicine information
        # -------------------------------------------------

        medicine = (
            MedicineInformation.query
            .filter(
                MedicineInformation.name.ilike(
                    f"%{medicine_name}%"
                )
            )
            .first()
        )

        # -------------------------------------------------
        # Live Apollo products. A pincode is passed only when
        # the user explicitly supplies one; never assume a city.
        # -------------------------------------------------

        products = get_apollo_live_products(
            medicine_name,
            pincode or None
        )

        # -------------------------------------------------
        # Detailed information
        # -------------------------------------------------

        detailed_products = (
            get_all_product_details(
                products
            )
        )

        # -------------------------------------------------
        # Response
        # -------------------------------------------------

        return jsonify({

            "success":
                True,

            "status":
                "success",

            "message": (
                "Medicine search completed. Online products are returned only "
                "when the configured provider responds successfully."
            ),

            "medicine":
                serialize_medicine(
                    medicine
                ),

            "products":
                products,

            "detailed_products":
                detailed_products,

            "count":
                len(products),

            "provider":
                "Apollo Pharmacy",

            "pincode":
                pincode,

            "availability_scope":
                "Apollo Pharmacy online/pincode availability",

            "live_availability":
                bool(products),

            "city": city,

            "availability_status": ("provider_results" if products else ("provider_unconfigured_or_no_results" if not ANAKIN_API_KEY else "provider_no_results")),

            "scraped_at":
                None

        }), 200

    except Exception as exc:

        print(
            "Medicine search route error:",
            exc
        )

        return jsonify({

            "success":
                False,

            "error":
                "Unable to retrieve medicine information."

        }), 500


# =========================================================
# PHARMACY LOCATIONS
# =========================================================

def _osm_pharmacies(city, pincode=None):
    """Look up real pharmacy locations from OpenStreetMap.

    Tries more than one geocoding query and Overpass mirror because public
    endpoints can temporarily return 429/504 errors. This is a directory
    lookup only; it does not verify medicine stock.
    """
    headers = {
        "User-Agent": "ElderSense/1.0 (pharmacy location search)",
        "Accept": "application/json",
    }

    # Try common alternate spellings for Hospet/Hosapete and include state.
    if pincode:
        search_queries = [f"{pincode}, India"]
    else:
        cleaned_city = (city or "").strip()
        search_queries = [
            f"{cleaned_city}, India",
            f"{cleaned_city}, Karnataka, India",
        ]
        if cleaned_city.lower() in {"hospet", "hosapete"}:
            search_queries.extend([
                "Hosapete, Vijayanagara, Karnataka, India",
                "Hospet, Karnataka, India",
            ])

    coordinates = None
    for search_text in dict.fromkeys(q for q in search_queries if q.strip()):
        try:
            geo = requests.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": search_text, "format": "jsonv2", "limit": 1, "countrycodes": "in"},
                headers=headers,
                timeout=(5, 12),
            )
            geo.raise_for_status()
            places = geo.json()
            if places:
                coordinates = (float(places[0]["lat"]), float(places[0]["lon"]))
                break
        except (requests.RequestException, ValueError, KeyError, TypeError) as exc:
            print(f"OpenStreetMap geocoding attempt failed for {search_text}: {exc}")

    if not coordinates:
        print(f"OpenStreetMap could not resolve location: {city or pincode}")
        return []

    lat, lon = coordinates
    overpass_query = f"""[out:json][timeout:20];
(
  node[\"amenity\"=\"pharmacy\"](around:15000,{lat},{lon});
  way[\"amenity\"=\"pharmacy\"](around:15000,{lat},{lon});
  relation[\"amenity\"=\"pharmacy\"](around:15000,{lat},{lon});
);
out center tags;"""

    # Public mirrors can be intermittently unavailable. Try each once.
    overpass_endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
    ]
    items = None
    for endpoint in overpass_endpoints:
        try:
            response = requests.post(
                endpoint,
                data={"data": overpass_query},
                headers=headers,
                timeout=(6, 28),
            )
            response.raise_for_status()
            payload = response.json()
            if isinstance(payload, dict) and isinstance(payload.get("elements"), list):
                items = payload["elements"]
                print(f"OpenStreetMap pharmacy lookup succeeded via {endpoint}; records: {len(items)}")
                break
            print(f"OpenStreetMap returned an unexpected response from {endpoint}")
        except (requests.RequestException, ValueError, TypeError) as exc:
            print(f"OpenStreetMap Overpass endpoint failed ({endpoint}): {exc}")

    if items is None:
        print("All OpenStreetMap Overpass endpoints failed for this request.")
        return []

    results = []
    seen = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        tags = item.get("tags") or {}
        name = (tags.get("name") or tags.get("brand") or tags.get("operator") or "").strip()
        if not name:
            continue

        center = item.get("center") or {}
        item_lat = item.get("lat", center.get("lat"))
        item_lon = item.get("lon", center.get("lon"))
        unique_key = (str(name).casefold(), str(item_lat), str(item_lon))
        if unique_key in seen:
            continue
        seen.add(unique_key)

        address_parts = [
            tags.get("addr:housenumber"),
            tags.get("addr:street"),
            tags.get("addr:suburb") or tags.get("addr:neighbourhood"),
            tags.get("addr:city") or city,
            tags.get("addr:state"),
            tags.get("addr:postcode") or pincode,
        ]
        address = ", ".join(str(part).strip() for part in address_parts if part and str(part).strip())
        phone = (
            tags.get("phone") or tags.get("contact:phone") or
            tags.get("mobile") or tags.get("contact:mobile") or
            tags.get("telephone") or tags.get("contact:telephone")
        )
        if item_lat is not None and item_lon is not None:
            map_url = (
                "https://www.google.com/maps/dir/?api=1&destination="
                f"{item_lat},{item_lon}"
            )
        else:
            map_query = ", ".join(part for part in [name, address, city] if part)
            map_url = "https://www.google.com/maps/search/?api=1&query=" + requests.utils.quote(map_query)

        results.append({
            "id": f"osm-{item.get('type')}-{item.get('id')}",
            "name": name,
            "address": address or f"Location in {city or pincode}",
            "city": tags.get("addr:city") or city,
            "state": tags.get("addr:state"),
            "pincode": tags.get("addr:postcode") or pincode,
            "phone": phone,
            "latitude": item_lat,
            "longitude": item_lon,
            "map_url": map_url,
            "source": "OpenStreetMap",
            "stock_status": "unknown",
            "stock_note": "OpenStreetMap provides location data only; medicine stock is not confirmed.",
        })

    return results[:60]

@pharmacy_bp.route("/locations", methods=["GET"])
def get_pharmacy_locations():
    city = request.args.get("city", "").strip()
    pincode = request.args.get("pincode", "").strip()
    medicine_name = request.args.get("medicine", "").strip()

    if not city and not pincode:
        return jsonify({"success": False, "error": "Enter a city or pincode to search pharmacies."}), 400
    if pincode and (not pincode.isdigit() or len(pincode) != 6):
        return jsonify({"success": False, "error": "Pincode must contain 6 digits."}), 400

    local_rows = []
    try:
        query = Pharmacy.query
        if city:
            query = query.filter(Pharmacy.city.ilike(city))
        if pincode:
            query = query.filter(Pharmacy.pincode == pincode)
        local_rows = query.order_by(Pharmacy.name.asc()).all()
    except Exception as exc:
        print(f"Local pharmacy database lookup failed: {type(exc).__name__}: {exc}")
        try:
            Pharmacy.query.session.rollback()
        except Exception as rollback_exc:
            print(f"Pharmacy database rollback failed: {rollback_exc}")
        local_rows = []

    results = []
    # Ignore known placeholder seed records and obviously fake phone numbers.
    placeholder_names = {"city care medicals", "healthplus pharmacy", "wellness medical store", "apollo care pharmacy"}
    for pharmacy in local_rows:
        if (pharmacy.name or "").strip().lower() in placeholder_names:
            continue
        if pharmacy.phone and pharmacy.phone.strip().startswith("900000000"):
            continue
        inventory = None
        if medicine_name:
            inventory = (PharmacyInventory.query
                .join(MedicineInformation, PharmacyInventory.medicine_id == MedicineInformation.id)
                .filter(PharmacyInventory.pharmacy_id == pharmacy.id)
                .filter(MedicineInformation.name.ilike(f"%{medicine_name}%"))
                .order_by(PharmacyInventory.updated_at.desc())
                .first())
        map_query = ", ".join(x for x in [pharmacy.name, pharmacy.address, pharmacy.city, pharmacy.pincode] if x)
        stock_status = "unknown"
        stock_quantity = None
        price = None
        if inventory:
            stock_quantity = inventory.quantity
            price = inventory.price
            status_text = (inventory.availability_status or "").strip().lower()
            if status_text in {"in_stock", "in stock", "available"}:
                stock_status = "in_stock"
            elif status_text in {"out_of_stock", "out of stock", "unavailable"}:
                stock_status = "out_of_stock"
            else:
                stock_status = "in_stock" if (inventory.quantity or 0) > 0 else "out_of_stock"
        results.append({
            "id": pharmacy.id, "name": pharmacy.name, "address": pharmacy.address,
            "city": pharmacy.city, "state": pharmacy.state, "pincode": pharmacy.pincode,
            "phone": pharmacy.phone, "latitude": pharmacy.latitude, "longitude": pharmacy.longitude,
            "map_url": "https://www.google.com/maps/search/?api=1&query=" + requests.utils.quote(map_query),
            "source": "Elder Sense pharmacy directory", "stock_status": stock_status,
            "quantity": stock_quantity, "price": price,
            "stock_note": (f"Inventory record from {inventory.data_source or 'Elder Sense database'} updated {inventory.updated_at.isoformat() if inventory.updated_at else 'at an unknown time'}; call the pharmacy to reconfirm." if inventory else "Pharmacy location found; medicine stock is not confirmed."),
        })

    if not results:
        results = _osm_pharmacies(city, pincode or None)
        if medicine_name:
            # OSM is a location directory, not a medicine stock source.
            for item in results:
                item["stock_status"] = "unknown"
                item["stock_note"] = "OpenStreetMap provides location data only; medicine stock is not available from this source."

    # A useful, honest fallback when neither the local directory nor OSM returns
    # records. This is a search link, not a claim that any specific pharmacy exists.
    fallback_query = "pharmacies near " + (pincode if pincode else city)
    fallback_search_url = (
        "https://www.google.com/maps/search/?api=1&query="
        + requests.utils.quote(fallback_query)
    ) if not results else None

    return jsonify({
        "success": True,
        "city": city or None,
        "pincode": pincode or None,
        "medicine": medicine_name or None,
        "count": len(results),
        "pharmacies": results,
        "fallback_search_url": fallback_search_url,
        "source_note": (
            "Directory results do not prove that a searched medicine is in stock. Contact the pharmacy to confirm."
            if results else
            "No verified directory records were returned. Public directory services may be unavailable or have incomplete coverage. Use the Google Maps search link to look for nearby pharmacies; confirm the address, phone number, and medicine stock before visiting."
        )
    }), 200
