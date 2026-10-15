import sys
from pathlib import Path

# Add project root to sys.path
root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(root))

from fastapi.testclient import TestClient
from backend.app.main import app

def run_tests():
    client = TestClient(app)

    print('--- Test 1: Old Dummy Account Login Rejected ---')
    res = client.post('/api/auth/login', json={'identifier': 'telemetry.lead@labguard.io', 'password': 'lg_demo_key_2026'})
    print('Dummy login status:', res.status_code)
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"

    print('--- Test 2: Invalid Email Registration ---')
    res = client.post('/api/auth/register', json={'email': 'not-an-email', 'password': 'Password123!', 'confirm_password': 'Password123!'})
    print('Invalid email status:', res.status_code)
    assert res.status_code == 422, f"Expected 422, got {res.status_code}"

    print('--- Test 3: Weak Password (missing special char) ---')
    res = client.post('/api/auth/register', json={'email': 'operator.alex@labguard.io', 'password': 'Password123', 'confirm_password': 'Password123'})
    print('Weak password status:', res.status_code)
    assert res.status_code == 422, f"Expected 422, got {res.status_code}"

    print('--- Test 4: Mismatched Password Confirmation ---')
    res = client.post('/api/auth/register', json={'email': 'operator.alex@labguard.io', 'password': 'Password123!@#', 'confirm_password': 'DifferentPassword123!'})
    print('Mismatched password status:', res.status_code)
    assert res.status_code == 422, f"Expected 422, got {res.status_code}"

    print('--- Test 5: Valid Standard Registration ---')
    res = client.post('/api/auth/register', json={'email': 'operator.alex@labguard.io', 'password': 'StrongKey@2026!', 'confirm_password': 'StrongKey@2026!'})
    print('Valid registration status:', res.status_code)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"

    print('--- Test 6: Check Email Endpoint ---')
    res = client.post('/api/auth/check-email', json={'email': 'operator.alex@labguard.io'})
    assert res.status_code == 200
    assert res.json()['exists'] is True

    res2 = client.post('/api/auth/check-email', json={'email': 'brandnew.google@gmail.com'})
    assert res2.status_code == 200
    assert res2.json()['exists'] is False

    print('--- Test 7: Google Registration Without Password Rejected ---')
    res = client.post('/api/auth/google', json={'email': 'new.user@gmail.com'})
    print('Google missing password status:', res.status_code)
    assert res.status_code == 422, f"Expected 422, got {res.status_code}"

    print('--- Test 8: Google Registration With Weak Password Rejected ---')
    res = client.post('/api/auth/google', json={'email': 'new.user@gmail.com', 'password': 'weak', 'confirm_password': 'weak'})
    print('Google weak password status:', res.status_code)
    assert res.status_code == 422, f"Expected 422, got {res.status_code}"

    print('--- Test 9: Google Registration With Mismatched Password Rejected ---')
    res = client.post('/api/auth/google', json={'email': 'new.user@gmail.com', 'password': 'StrongGoogleKey#2026', 'confirm_password': 'WrongPassword123'})
    print('Google mismatch status:', res.status_code)
    assert res.status_code == 422, f"Expected 422, got {res.status_code}"

    print('--- Test 10: Google Registration With Strong Created & Confirmed Password ---')
    res = client.post('/api/auth/google', json={
        'email': 'new.user@gmail.com',
        'password': 'StrongGoogleKey#2026',
        'confirm_password': 'StrongGoogleKey#2026'
    })
    print('Google registration status:', res.status_code)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    assert res.json()['email'] == 'new.user@gmail.com'

    print('--- Test 11: Google Existing User Login With Password ---')
    res = client.post('/api/auth/google', json={
        'email': 'new.user@gmail.com',
        'password': 'StrongGoogleKey#2026'
    })
    print('Google login status:', res.status_code)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"

    print('\n======================================================')
    print(' ALL TESTS PASSED: GOOGLE PERMISSION & PASSWORD FLOW ')
    print('======================================================')

if __name__ == '__main__':
    run_tests()
