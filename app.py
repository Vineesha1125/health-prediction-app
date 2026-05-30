from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import date, datetime
import requests
import os
import re

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///mira.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ── Model ────────────────────────────────────────────────────────────────────

class Patient(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    full_name   = db.Column(db.String(120), nullable=False)
    dob         = db.Column(db.Date, nullable=False)
    email       = db.Column(db.String(120), nullable=False)
    glucose     = db.Column(db.Float, nullable=False)
    haemoglobin = db.Column(db.Float, nullable=False)
    cholesterol = db.Column(db.Float, nullable=False)
    remarks     = db.Column(db.Text, default='')
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':          self.id,
            'full_name':   self.full_name,
            'dob':         self.dob.isoformat(),
            'email':       self.email,
            'glucose':     self.glucose,
            'haemoglobin': self.haemoglobin,
            'cholesterol': self.cholesterol,
            'remarks':     self.remarks,
            'created_at':  self.created_at.strftime('%d %b %Y'),
        }

# ── Helpers ──────────────────────────────────────────────────────────────────

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

def validate_patient(data, partial=False):
    errors = []
    fields = ['full_name', 'dob', 'email', 'glucose', 'haemoglobin', 'cholesterol']

    for f in fields:
        if not partial and f not in data:
            errors.append(f'{f} is required')

    if 'email' in data and not EMAIL_RE.match(data['email']):
        errors.append('Invalid email address')

    if 'dob' in data:
        try:
            dob = date.fromisoformat(data['dob'])
            if dob >= date.today():
                errors.append('Date of birth cannot be today or a future date')
        except ValueError:
            errors.append('Invalid date format for dob (use YYYY-MM-DD)')

    for field in ['glucose', 'haemoglobin', 'cholesterol']:
        if field in data:
            try:
                val = float(data[field])
                if val < 0:
                    errors.append(f'{field} must be a positive number')
            except (ValueError, TypeError):
                errors.append(f'{field} must be numeric')

    return errors


def get_ai_prediction(patient_data):
    """
    Call the Anthropic Claude API to get a health prediction.
    Set your ANTHROPIC_API_KEY environment variable before running.
    """
    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not api_key:
        return predict_locally(patient_data)

    prompt = f"""You are a medical AI assistant. Based on the following blood test results, provide a brief health risk assessment (2-3 sentences). Be informative but remind the user to consult a doctor.

Patient Details:
- Age: {patient_data['age']} years
- Glucose: {patient_data['glucose']} mg/dL
- Haemoglobin: {patient_data['haemoglobin']} g/dL
- Cholesterol: {patient_data['cholesterol']} mg/dL

Provide a concise health prediction and any notable risk factors."""

    try:
        response = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers={
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            json={
                'model': 'claude-haiku-4-5-20251001',
                'max_tokens': 300,
                'messages': [{'role': 'user', 'content': prompt}]
            },
            timeout=15
        )
        if response.status_code == 200:
            return response.json()['content'][0]['text'].strip()
    except Exception:
        pass

    return predict_locally(patient_data)


def predict_locally(p):
    """Rule-based fallback when no API key is set."""
    flags = []

    if p['glucose'] > 126:
        flags.append('High glucose may indicate diabetes risk')
    elif p['glucose'] > 100:
        flags.append('Borderline glucose — possible pre-diabetes')
    else:
        flags.append('Glucose within normal range')

    if p['haemoglobin'] < 12:
        flags.append('low haemoglobin suggesting possible anaemia')
    elif p['haemoglobin'] > 17.5:
        flags.append('elevated haemoglobin which may need further evaluation')
    else:
        flags.append('haemoglobin within normal limits')

    if p['cholesterol'] > 240:
        flags.append('High cholesterol — elevated cardiovascular risk')
    elif p['cholesterol'] > 200:
        flags.append('Borderline cholesterol — lifestyle changes recommended')
    else:
        flags.append('Cholesterol within healthy range')

    result = '. '.join(flags) + '. Please consult a healthcare professional for a full evaluation.'
    return result[0].upper() + result[1:]


def calc_age(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


# CREATE
@app.route('/api/patients', methods=['POST'])
def create_patient():
    data = request.get_json(force=True)
    errors = validate_patient(data)
    if errors:
        return jsonify({'error': '; '.join(errors)}), 400

    dob = date.fromisoformat(data['dob'])
    patient = Patient(
        full_name=data['full_name'].strip(),
        dob=dob,
        email=data['email'].strip().lower(),
        glucose=float(data['glucose']),
        haemoglobin=float(data['haemoglobin']),
        cholesterol=float(data['cholesterol']),
    )
    db.session.add(patient)
    db.session.flush()  # get ID before commit

    prediction = get_ai_prediction({
        'age': calc_age(dob),
        'glucose': patient.glucose,
        'haemoglobin': patient.haemoglobin,
        'cholesterol': patient.cholesterol,
    })
    patient.remarks = prediction
    db.session.commit()

    return jsonify(patient.to_dict()), 201


# READ ALL
@app.route('/api/patients', methods=['GET'])
def list_patients():
    search = request.args.get('q', '').strip()
    query = Patient.query
    if search:
        like = f'%{search}%'
        query = query.filter(
            db.or_(Patient.full_name.ilike(like), Patient.email.ilike(like))
        )
    patients = query.order_by(Patient.created_at.desc()).all()
    return jsonify([p.to_dict() for p in patients])


# READ ONE
@app.route('/api/patients/<int:pid>', methods=['GET'])
def get_patient(pid):
    p = db.get_or_404(Patient, pid)
    return jsonify(p.to_dict())


# UPDATE
@app.route('/api/patients/<int:pid>', methods=['PUT'])
def update_patient(pid):
    p = db.get_or_404(Patient, pid)
    data = request.get_json(force=True)
    errors = validate_patient(data, partial=True)
    if errors:
        return jsonify({'error': '; '.join(errors)}), 400

    changed_labs = False
    for field in ['full_name', 'email']:
        if field in data:
            setattr(p, field, data[field].strip())
    if 'dob' in data:
        p.dob = date.fromisoformat(data['dob'])
    for field in ['glucose', 'haemoglobin', 'cholesterol']:
        if field in data and float(data[field]) != getattr(p, field):
            setattr(p, field, float(data[field]))
            changed_labs = True

    if changed_labs:
        prediction = get_ai_prediction({
            'age': calc_age(p.dob),
            'glucose': p.glucose,
            'haemoglobin': p.haemoglobin,
            'cholesterol': p.cholesterol,
        })
        p.remarks = prediction

    db.session.commit()
    return jsonify(p.to_dict())


# DELETE
@app.route('/api/patients/<int:pid>', methods=['DELETE'])
def delete_patient(pid):
    p = db.get_or_404(Patient, pid)
    db.session.delete(p)
    db.session.commit()
    return jsonify({'message': 'Patient deleted successfully'})


# STATS for dashboard
@app.route('/api/stats', methods=['GET'])
def stats():
    total = Patient.query.count()
    high_glucose = Patient.query.filter(Patient.glucose > 126).count()
    high_chol    = Patient.query.filter(Patient.cholesterol > 240).count()
    low_hb       = Patient.query.filter(Patient.haemoglobin < 12).count()
    return jsonify({
        'total': total,
        'high_glucose': high_glucose,
        'high_cholesterol': high_chol,
        'low_haemoglobin': low_hb,
    })


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)