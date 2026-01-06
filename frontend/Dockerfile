FROM nginx:alpine

# Replace main nginx config so our proxy rules are active
COPY nginx.conf /etc/nginx/nginx.conf

# Copy static assets
COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
