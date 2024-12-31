import sys
import yt_dlp
import mysql.connector
from mysql.connector import Error
import datetime
from test_gpt import get_emotional_tags_for_track, get_artist_and_trackname

def connect_to_database() -> mysql.connector.connection.MySQLConnection:
    #connection = object()
    try:
        # Define database connection parameters
        connection = mysql.connector.connect(
            host='test-streaming.ct22uy2kkba5.us-east-2.rds.amazonaws.com',          # Change to your MySQL server address if not local
            user='admin',      # Replace with your MySQL username
            password='Ifuckingh8hack3r$',  # Replace with your MySQL password
        )

        if connection.is_connected():
            print("Connection to MySQL database was successful!")
            
            # Get server information
            db_info = connection.get_server_info()
            print(f"Connected to MySQL Server version: {db_info}")

            # Optionally, query the database
            cursor = connection.cursor()
            cursor.execute("SELECT DATABASE();")
            record = cursor.fetchone()
            print(f"Connected to database: {record[0]}")
            return connection

    except Error as e:
        print(f"Error while connecting to MySQL: {e}")


# Check if artist track exist already
conn = connect_to_database()
cursor = conn.cursor()
cursor.execute(f"""CREATE TABLE `test-streaming`.resources (
  `path` VARCHAR(150) NOT NULL,
  `release_dt` DATETIME NULL,
  `insert_dt` DATETIME NULL,
  `update_dt` DATETIME NULL,
  `title` VARCHAR(150) NOT NULL,
  `artist` VARCHAR(150) NOT NULL,
  PRIMARY KEY (`title`, `artist`))""")
conn.commit() 
cursor.execute(f"""CREATE TABLE `test-streaming`.users (
	`username` VARCHAR(100) NOT NULL,
	`password` VARCHAR(100) NOT NULL,
	PRIMARY KEY (`username`))""")
conn.commit() 
cursor.execute(f"""CREATE TABLE `test-streaming`.track_collection (
  `collection_id` int NOT NULL,
  `username` varchar(100) NOT NULL,
  `title` varchar(150) NOT NULL,
  `artist` varchar(150) NOT NULL,
  `insert_dt` datetime NOT NULL,
  PRIMARY KEY (`collection_id`,`username`,`title`,`artist`)
)""")
conn.commit() 
cursor.execute(f"""CREATE TABLE `test-streaming`.user_collection (
  `collection_id` int NOT NULL,
  `username` varchar(100) NOT NULL,
  `collection_name` varchar(100) NOT NULL,
  `is_public` tinyint NOT NULL,
  PRIMARY KEY (`collection_id`,`username`)
)""")
conn.commit() 
cursor.execute(f"""CREATE TABLE `test-streaming`.streams (
  `username` varchar(100) NOT NULL,
  `title` varchar(150) NOT NULL,
  `artist` varchar(150) NOT NULL,
  `collection_id` int NOT NULL,
  `length` int NOT NULL,
  `insert_dt` datetime NOT NULL,
  PRIMARY KEY (`username`,`title`,`artist`,`collection_id`,`insert_dt`)
)""")
conn.commit()
cursor.execute(f"""CREATE TABLE `test-streaming`.tags (
  `artist` VARCHAR(150) NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `resource_path` VARCHAR(150) NOT NULL,
  `tag` VARCHAR(150) NOT NULL,
  PRIMARY KEY (`tag`, `resource_path`))""")
conn.commit()