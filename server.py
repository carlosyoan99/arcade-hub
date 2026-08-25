import http.server
import socketserver

PORT = 8000
socketserver.TCPServer.allow_reuse_address = True

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print("Serving at port", PORT)
    httpd.serve_forever()
