import sys
import time
import socket
import urllib.request
import urllib.error

def wait_for_port(host, port, timeout=30):
    """
    Smart Wait: Tries to connect to the port repeatedly until it opens.
    Stops waiting as soon as the service is ready.
    """
    start_time = time.time()
    print(f"⏳ Waiting for {host}:{port} to be ready...", end="", flush=True)
    
    while True:
        try:
            with socket.create_connection((host, int(port)), timeout=1):
                print(f"\n✅ Service is up on {host}:{port}!")
                return True
        except (OSError, ConnectionRefusedError):
            if time.time() - start_time > timeout:
                print(f"\n❌ Timeout waiting for {host}:{port}")
                sys.exit(1)
            time.sleep(1)
            print(".", end="", flush=True)


def wait_for_http(url, timeout=60):
    """
    Wait for an HTTP endpoint to return a successful response.
    This is more reliable than port checking for FastAPI apps that need
    time to initialize routes and run startup events.
    """
    start_time = time.time()
    print(f"⏳ Waiting for {url} to respond...", end="", flush=True)
    
    while True:
        try:
            req = urllib.request.Request(url, method='GET')
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    print(f"\n✅ API is ready!")
                    return True
        except (urllib.error.URLError, urllib.error.HTTPError, ConnectionResetError, 
                ConnectionRefusedError, OSError) as e:
            if time.time() - start_time > timeout:
                print(f"\n❌ Timeout waiting for {url}")
                print(f"   Last error: {e}")
                sys.exit(1)
            time.sleep(1)
            print(".", end="", flush=True)

def confirm_clean():
    """
    Cross-platform safety check for the clean command.
    """
    print("⚠️  WARNING: This will remove all volumes (database data) and local images.")
    print("   Waiting 5 seconds... (Ctrl+C to cancel)")
    try:
        for i in range(5, 0, -1):
            print(f"   {i}...", end="\r", flush=True)
            time.sleep(1)
        print("   Proceeding...           ")
    except KeyboardInterrupt:
        print("\n❌ Cancelled.")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python utils.py [wait_port|wait_http|clean_confirm] [args]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "wait_port":
        # Usage: python utils.py wait_port localhost 8000
        host = sys.argv[2] if len(sys.argv) > 2 else "localhost"
        port = sys.argv[3] if len(sys.argv) > 3 else "8000"
        wait_for_port(host, port)
    
    elif command == "wait_http":
        # Usage: python utils.py wait_http http://localhost:8000/api/v1/health
        url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000/api/v1/health"
        wait_for_http(url)
    
    elif command == "clean_confirm":
        confirm_clean()
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
