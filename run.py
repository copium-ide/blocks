import http.server
import socketserver
import webbrowser
import threading

PORT = 8000  # Change this if you need a different port
ADDRESS = f"http://localhost:{PORT}"
# Open the address in the default web browser
webbrowser.open(ADDRESS)

class Handler(http.server.SimpleHTTPRequestHandler):
    pass

def start_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving at {ADDRESS}")
        httpd.serve_forever()

start_server()


