FROM --platform=linux/amd64 denoland/deno

EXPOSE 8000

WORKDIR /app

ADD . /app


RUN deno install --entrypoint main.ts

CMD ["deno","task", "start"]
