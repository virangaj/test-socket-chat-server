# Use the official Node.js image.
# Use 'node:lts' for the latest LTS version or specify a version like 'node:14'
FROM node:18.18.0

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files.
COPY package*.json ./

# Install dependencies.
RUN npm install

# Copy the rest of the application code.
COPY . .

# Change to the server directory
WORKDIR /usr/src/app/server

# Expose the port the app runs on.
EXPOSE 3001

# Define the command to run the app.
CMD ["node", "index.js"]
