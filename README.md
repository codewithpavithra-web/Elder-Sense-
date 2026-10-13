# Elder Sense — Final source package

This package preserves the existing React/Vite + Flask + PostgreSQL application and UI. It contains targeted corrections for data-model compatibility, medication reminder scheduling, pharmacy search, doctor lookup, and access from a second device on the same local network.

## Important data-safety notes

- The backend uses PostgreSQL as the source of truth for accounts, medication logs, vitals, notifications, and appointments.
- No database reset, truncation, or reseeding is performed by the app startup.
- Startup runs `db.create_all()` for missing tables and a small PostgreSQL-only compatibility migration that adds missing nullable/optional reminder columns. It does not delete records.
- The included `seed_data.py` only adds general medicine reference information if missing. It does not seed fake pharmacies, doctor profiles, phone numbers, or stock.
- Pharmacy location search uses existing non-placeholder Elder Sense directory entries first and OpenStreetMap as a best-effort fallback. Location data does not confirm stock.
- Doctor Finder lists registered Elder Sense doctor profiles marked available. It is not a complete nationwide verified doctor directory. No doctor-directory API key is configured in this project.
- Audible caregiver alerts require the caregiver dashboard to be open and sound/voice alerts enabled in that browser. A normal web page cannot guarantee sound when closed or when the operating system blocks it.

## Backend setup (Windows PowerShell)

1. Install Python 3.11 and PostgreSQL. Make sure the `elder_sense` database exists and your existing records are in it.
2. Open PowerShell in `Elder-Sense\backend`.
3. Create your local environment file:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

4. Replace `DATABASE_URL` and `JWT_SECRET_KEY` with your own values. Add `ANAKIN_API_KEY` and/or `OPENAI_API_KEY` only if you have valid credentials. Never share `.env`.
5. Install dependencies and run the server:

   ```powershell
   py -3.11 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   python app.py
   ```

6. Confirm `http://127.0.0.1:5000/` returns a running status. Confirm `http://127.0.0.1:5000/api/test-db` connects to PostgreSQL.

## Frontend setup

Open a second PowerShell window in `Elder-Sense\frontend`:

```powershell
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Using the app from another phone on the same Wi-Fi

1. Find the computer's private IPv4 address with `ipconfig` (for example, `192.168.1.20`).
2. Keep Flask running on port 5000 and Vite on port 5173. Both are configured to listen on the network interface.
3. On the phone, open `http://COMPUTER_IP:5173` (replace `COMPUTER_IP`).
4. If Windows Firewall prompts you, allow Python/Node on your **private network only**. Both devices must be on the same Wi-Fi. The phone must log in with its own user account.
5. The frontend derives the API hostname from the page URL, so the phone calls the computer's port 5000 instead of its own localhost.

## Connecting the roles

- Register the elder, caregiver, and doctor accounts through the existing app.
- A caregiver must have an active `caregiver_elder_links` association to the correct elder profile before the caregiver dashboard can access that elder's data.
- A doctor must have an active `doctor_elder_links` association to access an elder's clinical records.
- For existing accounts, the included `create_caregiver.py` and `link_doctor.py` scripts ask for the account emails and create only the requested relationship. Run them only with the elder's consent and with the backend environment configured:

  ```powershell
  python create_caregiver.py
  python link_doctor.py
  ```

- `create_doctor.py` can create a doctor account from details entered by the operator; only enter information supplied by the real doctor. New doctor profiles are hidden from public search until the institution verifies the supplied details and marks the profile available. The app does not independently verify a medical licence.

## Medication reminder behavior

- The frontend can show audible/voice reminders while the elder's medication page is open and browser audio is permitted.
- The backend scheduler checks active schedules every 30 seconds and marks an unconfirmed dose `MISSED` after the configured 15-minute grace period.
- The backend writes a persistent notification for each actively linked caregiver. The caregiver dashboard polls notifications every 5 seconds and can sound/speak alerts after the caregiver enables them.
- The 5-minute follow-up reminder is browser-based and therefore requires the elder page to remain open. The backend missed-dose detection does not depend on the elder browser remaining open.
- Do not run multiple copies of `python app.py` against the same database; each process would start a scheduler.

## Pharmacy and doctor search limitations

- Live Apollo online product lookup uses the existing Anakin integration and only works when `ANAKIN_API_KEY` is valid and the configured action is available to the account.
- OpenStreetMap provides pharmacy locations, not inventory. If the external directory is unavailable, search can return no external results.
- Local stock is displayed only if a matching `pharmacy_inventory` record exists. It should still be reconfirmed by phone because freshness depends on the record's source and timestamp.
- Doctor Finder displays actual doctor-profile rows in your database, filtered by city and availability flag. It does not invent doctors and does not guarantee an appointment slot.

## Test status

The source package is syntax-checked with Python's `compileall`. A full backend API/integration test requires installing `backend/requirements.txt`, configuring PostgreSQL credentials, and using the existing database. A frontend production build requires `npm ci` to complete successfully. These external integration checks must be run in the local environment; this package does not claim they passed without execution.
