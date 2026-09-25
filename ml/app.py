from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


@app.route("/predict", methods=["POST"])
def predict():
    # Stub: replace with model inference once a trained model is in ml/model/
    _payload = request.get_json(silent=True) or {}
    return jsonify({"risk_level": "Low", "confidence": 0.9})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
