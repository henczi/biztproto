# biztproto

HTTPS tanusítvány generálása:
```
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -keyout localhost-privkey.pem -out localhost-cert.pem
```