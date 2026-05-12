#!/bin/sh
set -e
envsubst '${API_URL} ${WS_URL}' < /etc/nginx/templates/config.js.template > /usr/share/nginx/html/config.js
exec nginx -g 'daemon off;'
