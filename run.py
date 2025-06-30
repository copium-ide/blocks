from http.server import SimpleHTTPRequestHandler, HTTPServer

def run(server_class=HTTPServer, handler_class=SimpleHTTPRequestHandler, port=8000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"Serving HTTP on port {port} (http://localhost:{port}/) ...")
    httpd.serve_forever()

if __name__ == '__main__':
    run()