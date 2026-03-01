# Copyright (c) 2026 Aaron Guo. All rights reserved.
# Use of this source code is governed by the proprietary license
# found in the LICENSE file in the root directory of this source tree.

import sys
import time
import socket
import urllib.request
import urllib.error
import subprocess
import platform
import shutil
import re
import os

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

def _get_pid_via_lsof(port):
    """Helper to find PID using lsof (Unix)."""
    if not shutil.which("lsof"):
        return None
    try:
        result = subprocess.run(
            ["lsof", "-t", f"-i:{port}"],
            capture_output=True, text=True
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split('\n')[0] # Return first PID
    except Exception:
        pass
    return None

def _get_pid_via_ss(port):
    """Helper to find PID using ss (Linux fallback)."""
    if not shutil.which("ss"):
        return None
    try:
        # ss -lptn 'sport = :8000'
        # Output contains: "users:(("python",pid=123,fd=3))"
        result = subprocess.run(
            ["ss", "-lptn", f"sport = :{port}"],
            capture_output=True, text=True
        )
        match = re.search(r'pid=(\d+)', result.stdout)
        if match:
            return match.group(1)
    except Exception:
        pass
    return None

def _get_pid_via_netstat(port):
    """Helper to find PID using netstat (Linux/Windows fallback)."""
    if not shutil.which("netstat"):
        return None
    try:
        # Linux netstat -nlp
        result = subprocess.run(
            ["netstat", "-nlp"],
            capture_output=True, text=True
        )
        # Look for line containing port and extract PID
        # tcp 0 0 0.0.0.0:8000 ... LISTEN 1234/python
        for line in result.stdout.split('\n'):
            if f":{port}" in line and "LISTEN" in line:
                parts = line.split()
                # Last part often contains PID/ProgramName (e.g., 1234/python)
                for part in parts:
                    if '/' in part and part.split('/')[0].isdigit():
                        return part.split('/')[0]
    except Exception:
        pass
    return None

def kill_port(port):
    """
    Identifies and stops processes or Docker containers using a specific port.
    """
    print(f"🔍 Checking port {port} for conflicts...")

    # 1. Check for Docker containers first
    try:
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
        pass # Docker not installed
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Docker check failed: {e}")

    # 2. Check System Processes
    system = platform.system()
    pid = None

    if system == "Windows":
        try:
            cmd = f"netstat -ano | findstr :{port}"
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
        pid = _get_pid_via_lsof(port)
        if not pid and system == "Linux":
            pid = _get_pid_via_ss(port)
        if not pid and system == "Linux":
            pid = _get_pid_via_netstat(port)

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


def create_branch(branch_name):
    """
    Cross-platform git branch creation.
    """
    if not branch_name:
        print("⚠️  Usage: make branch <name>")
        sys.exit(1)
        
    print(f"🌿 Creating branch: {branch_name}")
    try:
        # Check if branch exists locally
        subprocess.run(["git", "checkout", "-b", branch_name], check=True)
        # Push upstream
        subprocess.run(["git", "push", "--set-upstream", "origin", branch_name], check=True)
        print(f"✅ Branch '{branch_name}' created and pushed.")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to create branch: {e}")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python utils.py [wait_port|wait_http|clean_confirm|kill_port|branch] [args]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "wait_port":
        host = sys.argv[2] if len(sys.argv) > 2 else "localhost"
        port = sys.argv[3] if len(sys.argv) > 3 else "8000"
        wait_for_port(host, port)
    
    elif command == "wait_http":
        url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000/api/v1/health"
        wait_for_http(url)
    
    elif command == "clean_confirm":
        confirm_clean()
    
    elif command == "kill_port":
        port = sys.argv[2] if len(sys.argv) > 2 else "8000"
        kill_port(port)

    elif command == "branch":
        branch_name = sys.argv[2] if len(sys.argv) > 2 else None
        create_branch(branch_name)
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
