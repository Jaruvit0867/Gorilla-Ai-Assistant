# syntax=docker/dockerfile:1.7

FROM --platform=linux/amd64 maven:3.9.11-eclipse-temurin-25 AS build

WORKDIR /workspace

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

RUN chmod +x mvnw
RUN ./mvnw -B -q dependency:go-offline

COPY src/ src/

RUN ./mvnw -B -DskipTests package \
    && cp target/*.jar /workspace/app.jar

FROM --platform=linux/amd64 eclipse-temurin:25-jre

WORKDIR /app

RUN groupadd --system spring \
    && useradd --system --gid spring --create-home spring

COPY --from=build /workspace/app.jar /app/app.jar

ENV SERVER_PORT=8080
ENV JAVA_OPTS=""

EXPOSE 8080

USER spring:spring

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
