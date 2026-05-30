# MIRA – Medical Intelligence Robotic Automation
### Health Prediction Application — Task 1 Submission

---

## Tech Stack
| Layer | Technology |
|---|---|
| Backend | Python 3 + Flask + Flask-SQLAlchemy |
| Database | SQLite (file-based, zero config) |
| Frontend | HTML5 + CSS3 + Vanilla JavaScript |
| AI/ML | Anthropic Claude API (Haiku) + rule-based fallback |

---

## Setup & Run

### 1. Clone / download the project
```bash
git clone <your-repo-url>
cd mira-health
```

### 2. Create and activate a virtual environment
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set your Anthropic API key (optional but recommended)
The app works without an API key using a built-in rule-based predictor.
For full AI predictions, set your key:
```bash
# Windows
set ANTHROPIC_API_KEY=sk-ant-...
# macOS / Linux
export ANTHROPIC_API_KEY=sk-ant-...
```

> **Never commit your API key to GitHub.** The app reads it from the environment — keep it there.

### 5. Run the application
```bash
python app.py
```
Open your browser at **http://localhost:5000**

---

## Features

### CRUD Operations
- **Create** – Add a new patient with name, DOB, email, and blood test values
- **Read** – Dashboard overview + full patient list with search
- **Update** – Edit any patient record; lab changes trigger a new AI prediction
- **Delete** – Soft-confirm dialog before permanent removal

### Data Validation
- Email format check (regex)
- DOB cannot be today or in the future
- Glucose / Haemoglobin / Cholesterol must be positive numbers
- All fields are required on create

### AI/ML Prediction
When valid patient data is saved the app calls the **Anthropic Claude claude-haiku-4-5-20251001** model with the patient's blood panel and receives a 2–3 sentence health risk summary stored in the *Remarks* field.

If no API key is present, the app falls back to a deterministic rule engine:
| Marker | Normal | Warning | High Risk |
|---|---|---|---|
| Glucose | < 100 mg/dL | 100–126 | > 126 |
| Haemoglobin | 12–17.5 g/dL | — | < 12 or > 17.5 |
| Cholesterol | < 200 mg/dL | 200–240 | > 240 |

### Dashboard
Live stats: total patients, high-glucose count, high-cholesterol count, low-haemoglobin count — plus a table of the 5 most recent records.

---

## Project Structure
```
mira-health/
├── app.py                 # Flask app, routes, AI integration
├── requirements.txt
├── README.md
├── instance/
│   └── mira.db            # SQLite database (auto-created on first run)
├── templates/
│   └── index.html         # Single-page UI
└── static/
    ├── css/style.css
    └── js/app.js
```

---

## Security Note
The `instance/mira.db` file contains patient data — add it to `.gitignore` for real deployments:
```
instance/
*.db
.env
```