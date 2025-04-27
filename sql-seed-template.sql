CREATE DATABASE MOCK_DB;
USE MOCK_DB;
CREATE TABLE MOCK_DATA (
    id int AUTO_INCREMENT,
    first_name varchar(255),
    last_name varchar(255),
    gender varchar(255),
    ip_address varchar(255),
    PRIMARY KEY (id)
);

INSERT INTO MOCK_DATA (
  first_name, 
  last_name,
  gender, 
  ip_address)
VALUES (
  <FIRST_NAME>, 
  <LAST_NAME>,
  <GENDER>, 
  <IP_ADDRESS>
);

