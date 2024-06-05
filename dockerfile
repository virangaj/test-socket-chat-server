# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Copy the .env file
COPY .env .env

# Expose the port the app runs on
EXPOSE 3001

# Define environment variable
ENV PORT=3001

# Run the application
CMD ["node", "server/index.js"]
