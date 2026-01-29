import sys
import time
import socket
import urllib.request
import urllib.error
import subprocess
import platform
import re

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

def kill_port(port):
    """
    Identifies and stops processes or Docker containers using a specific port.
    """
    print(f"🔍 Checking port {port} for conflicts...")

    # 1. Check for Docker containers first
    try:
        # returns container IDs
        result = subprocess.run(
            ["docker", "ps", "--filter", f"publish={port}", "--format", "{{.ID}}"],
            capture_output=True, text=True
        )
        if result.returncode == 0 and result.stdout.strip():
            container_ids = result.stdout.strip().split('\n')
            for cid in container_ids:
                print(f"🐳 Found Docker container {cid} on port {port}. Stopping...")
                subprocess.run(["docker", "stop", cid], check=True)
            print(f"✅ Docker container(s) stopped. Port {port} should be free.")
            return
    except FileNotFoundError:
        # Docker not found or not in path, proceed to system check
        pass
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Docker check failed: {e}")

    # 2. Check System Processes
    system = platform.system()
    pid = None

    if system == "Windows":
        try:
            # netstat -ano | findstr :PORT
            # Output example: "  TCP    0.0.0.0:8000           0.0.0.0:0              LISTENING       1234"
            cmd = f"netstat -ano | findstr :{port}"
            # Use shell=True for pipe support in Windows
            result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
            if result.stdout:
                lines = result.stdout.strip().split('\n')
                for line in lines:
                    if f":{port}" in line and "LISTENING" in line:
                        parts = line.strip().split()
                        pid = parts[-1]
                        break
        except Exception as e:
            print(f"⚠️  Windows process check failed: {e}")

    else: # Linux / macOS
        try:
            # lsof -t -i:PORT (returns only PID)
            result = subprocess.run(
                ["lsof", "-t", f"-i:{port}"], 
                capture_output=True, text=True
            )
            if result.stdout:
                pid = result.stdout.strip()
        except FileNotFoundError:
            # lsof might not be installed; try netstat or ss as fallback? 
            # For now simplified as per plan.
            pass

    # 3. Kill Process if found
    if pid:
        print(f"🔍 Found process PID {pid} on port {port}.")
        try:
            if system == "Windows":
                print(f"🛑 Killing process {pid} (Windows)...")
                subprocess.run(["taskkill", "/F", "/PID", pid], check=True, capture_output=True)
            else:
                print(f"🛑 Killing process {pid} (Unix)...")
                subprocess.run(["kill", "-9", pid], check=True)
            
            print(f"✅ Process {pid} killed. Port {port} is free.")
        except subprocess.CalledProcessError:
            print(f"❌ Failed to kill process {pid}. Access Denied or process already gone.")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error killing process: {e}")
            sys.exit(1)
    else:
        print(f"✅ Port {port} is already available.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python utils.py [wait_port|wait_http|clean_confirm|kill_port] [args]")
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
    
    elif command == "kill_port":
        # Usage: python utils.py kill_port 8000
        port = sys.argv[2] if len(sys.argv) > 2 else "8000"
        kill_port(port)
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
