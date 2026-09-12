import httpx
import sys

URL = "http://127.0.0.1:8000"

def test_auth():
    print("Testing Registration...")
    reg_data = {
        "display_name": "testuser",
        "email": "test@example.com",
        "password": "Password123!"
    }
    headers = {"Origin": "http://localhost:3000"}
    r = httpx.post(f"{URL}/api/auth/register", json=reg_data, headers=headers)
    if r.status_code == 201:
        print("Registration Successful!")
    elif r.status_code == 409:
        print("User already exists, proceeding to login...")
    else:
        print(f"Registration Failed: {r.status_code} {r.text}")
        sys.exit(1)

    print("\nTesting Login...")
    login_data = {
        "email": "test@example.com",
        "password": "Password123!"
    }
    r = httpx.post(f"{URL}/api/auth/login", json=login_data, headers=headers)
    if r.status_code == 200:
        data = r.json()
        if "access_token" in data and "refresh_token" in data:
            print("Login Successful! Received tokens.")
            print(f"Access Token: {data['access_token'][:15]}...")
        else:
            print("Login response did not contain tokens!")
            sys.exit(1)
    else:
        print(f"Login Failed: {r.status_code} {r.text}")
        sys.exit(1)

if __name__ == "__main__":
    test_auth()
