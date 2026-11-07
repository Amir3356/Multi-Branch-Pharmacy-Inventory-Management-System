# api-gateway: nginx, the one public entry point (see nginx.conf)
FROM nginx:alpine

# A template: on start the image fills in ${INTERNAL_SERVICE_SECRET} from the environment
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 8000
