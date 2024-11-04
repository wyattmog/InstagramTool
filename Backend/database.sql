CREATE DATABASE instagram_tool;
USE instagram_tool;

CREATE TABLE followers (
    user_id VARCHAR(255) NOT NULL,
    follower_link VARCHAR(255) NOT NULL,
    follower_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (user_id, follower_id, follower_link)
);

CREATE TABLE following (
    user_id VARCHAR(255) NOT NULL,
    following_link VARCHAR(255) NOT NULL,
    following_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (user_id, following_id, following_link)
);

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);