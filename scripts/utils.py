import sys
import time
import socket

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
        print("Usage: python utils.py [wait_port|clean_confirm] [args]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "wait_port":
        # Usage: python utils.py wait_port localhost 8000
        host = sys.argv[2] if len(sys.argv) > 2 else "localhost"
        port = sys.argv[3] if len(sys.argv) > 3 else "8000"
        wait_for_port(host, port)
    
    elif command == "clean_confirm":
        confirm_clean()
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
