FROM public.ecr.aws/lambda/nodejs:18

RUN yum update -y && \
    yum install -y \
    wget \
    unzip \
    && yum clean all

RUN curl -fsSL https://bun.sh/install | bash && mv /root/.bun/bin/bun /usr/local/bin/bun

WORKDIR /var/task

COPY package*.json ./
RUN bun install --production

COPY src/ ./src/

CMD ["src/starter.handler"]