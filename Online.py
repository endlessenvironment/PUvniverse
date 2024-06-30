import http.server
import ssl
import os


os.chdir(r"C:\Users\_420\Documents\puvniverse")


server_address = ('', 4443)  


httpd = http.server.HTTPServer(server_address, http.server.SimpleHTTPRequestHandler)


context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile="certificate.pem", keyfile="private.key")


httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"Serving on https://{server_address[0]}:{server_address[1]}")
httpd.serve_forever()
