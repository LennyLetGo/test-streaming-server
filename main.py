import sys
import yt_dlp
import mysql.connector
from mysql.connector import Error
import datetime

def connect_to_database() -> mysql.connector.connection.MySQLConnection:
    try:
        # Define database connection parameters
        connection = mysql.connector.connect(
            host='localhost',          # Change to your MySQL server address if not local
            user='root',      # Replace with your MySQL username
            password='password',  # Replace with your MySQL password
            database='streaming_test'   # Replace with your database name
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

    except Error as e:
        print(f"Error while connecting to MySQL: {e}")
    finally:
        if connection.is_connected():
            return connection

def test(info):
    if info['status'] == 'finished':
        title = info['info_dict']['title']
        try:
            artist = info['info_dict']['artists'][0]
        except:
            artist='NA'
        resource_path = f"{info['info_dict']['filename'][6:-4]}wav".replace(' ', '_')
        if artist == '' or title == '':
            print('err')
        else:
            # Check if artist track exist already
            conn = connect_to_database()
            cursor = conn.cursor()
            cursor.execute(f"SELECT * FROM streaming_test.resources WHERE track = '{title}' AND artist = '{artist}'")
            results = cursor.fetchall()
            if len(results) == 0:
                # Upload data
                cursor.execute(f"INSERT INTO streaming_test.resources (artist, title, path, release_dt, insert_dt, update_dt) VALUES ('{artist}', '{title}', '{resource_path}', '{datetime.datetime.now()}', '{datetime.datetime.now()}', '{datetime.datetime.now()}')")
                conn.commit()          
            else:
                print("RESOURCE EXISTS")
                print(results)
            cursor.close()
            conn.close()
            pass

        

# URLS = ['https://www.youtube.com/watch?v=016u3AM_0os']#'https://www.youtube.com/watch?v=NFsXOlHqIIg']#'https://www.youtube.com/watch?v=QDClypRn5DM&list=PLK_ZhYyF2sjvZzbni8rt4QttZL0Te2kKZ&index=7']#'https://www.youtube.com/watch?v=MKWJepzv2T0']#'https://www.youtube.com/watch?v=bj6tDXBSt1g']#https://www.youtube.com/watch?v=cXQ3UV-GLkI']
import os

def rename_files_in_directory(directory_path):
    try:
        # Get all files in the directory
        for filename in os.listdir(directory_path):
            file_path = os.path.join(directory_path, filename)
            
            # Check if it's a file (not a subdirectory)
            if os.path.isfile(file_path):
                # Replace spaces with underscores in the filename
                new_filename = filename.replace(' ', '_')
                
                # Create the new file path
                new_file_path = os.path.join(directory_path, new_filename)
                
                # Rename the file
                os.rename(file_path, new_file_path)
                print(f"Renamed: {filename} -> {new_filename}")
                
    except Exception as e:
        print(f"Error: {e}")


if __name__ == '__main__':
    # Check if URL is provided as a command-line argument
    if len(sys.argv) < 2:
        print("Usage: python script.py <URL>")
        sys.exit(1)

    # Get the URL from command-line arguments
    video_url = [sys.argv[1]]
    ydl_opts = {
        'cookiefile': 'www.youtube.com.txt',  # Path to your cookies.txt
        'format': 'wav/bestaudio/best',
        'outtmpl': '%(artist)s-%(title)s.%(ext)s'.replace(' ', '_'),  # Output template for artist - title
        # ℹ️ See help(yt_dlp.postprocessor) for a list of available Postprocessors and their arguments
        'postprocessors': [{  # Extract audio using ffmpeg
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
        }],
        'paths': {
            'home': 'audio'
        },
        #'progress_hooks': [test],
        'postprocessor_hooks': [test]
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        error_code = ydl.download(video_url)
    rename_files_in_directory("audio")
    exit(0)