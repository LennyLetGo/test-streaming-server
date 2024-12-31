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
            # host='localhost',          # Change to your MySQL server address if not local
            # user='root',      # Replace with your MySQL username
            # password='password',  # Replace with your MySQL password
            # database='test-streaming'   # Replace with your database name
            host='test-streaming.ct22uy2kkba5.us-east-2.rds.amazonaws.com',          # Change to your MySQL server address if not local
            user='admin',      # Replace with your MySQL username
            password='Ifuckingh8hack3r$',  # Replace with your MySQL password
            database='test-streaming'   # Replace with your database name
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
        title = info['info_dict']['title'].replace(u'\u29f8','').replace(u'\uff0c','').replace('/','').replace("'",'')
        try:
            artists = info['info_dict']['artists']
            art = ''
            for index, artist in enumerate(artists):
                if index == 0 and len(artists) > 1:
                    art = f'{art}{artist},'
                elif index == 0 and len(artists) == 1:
                    art = f'{art}{artist}'
                elif index < len(artists)-1:
                    art = f'{art} {artist},'
                else:
                    if len(artists) > 1:
                        art = f'{art} {artist}'
                    else:
                        art = f'{artist}'
            artist = art.replace(u'\u29f8','').replace(u'\uff0c','').replace("'",'')
        except:
            artist='NA'
        resource_path = f"{info['info_dict']['filename'][6:-4]}wav".replace(u'\u29f8','').replace(u'\uff0c','').replace(' ', '_').replace("'",'')
        # Try to get the real artist name
        artist, title = get_artist_and_trackname()
        # Grab tags
        # tags = info['info_dict']['tags']
        tags = get_emotional_tags_for_track(resource_path)
        # Check if artist track exist already
        conn = connect_to_database()
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM `test-streaming`.resources WHERE title = '{title}' AND artist = '{artist}'")
        results = cursor.fetchall()
        if len(results) == 0:
            # Upload data
            cursor.execute(f"INSERT INTO `test-streaming`.resources (artist, title, path, release_dt, insert_dt, update_dt) VALUES ('{artist}', '{title}', '{resource_path}', '{datetime.datetime.now()}', '{datetime.datetime.now()}', '{datetime.datetime.now()}')")
            conn.commit()          
        else:
            print("RESOURCE EXISTS")
            print(results)
        
        # Add Tags
        for tag in tags:
            sql = f"INSERT INTO `test-streaming`.tags (artist, title, resource_path, tag) VALUES ('{artist}', '{title}', '{resource_path}', '{tag}')"
            try:
                cursor.execute(sql)
            except:
                print('Exists already')
            conn.commit()

        cursor.close()
        conn.close()
        pass

def on_finish_extracting_audio(info):
    artists = []
    pid = os.getpid()
    if info['status'] == 'finished':
        try:
            artists = info['info_dict']['artists']
            with open(f'{pid}-artists.txt', "w") as f:
                if len(artists) > 1:
                    for index, artist in enumerate(artists):
                        if index != len(artists)-1:
                            f.write(f"{artist};")
                        else:
                            f.write(f"{artist}")
                else:
                    f.write(artists[0])
        except:
            pass


# URLS = ['https://www.youtube.com/watch?v=016u3AM_0os']#'https://www.youtube.com/watch?v=NFsXOlHqIIg']#'https://www.youtube.com/watch?v=QDClypRn5DM&list=PLK_ZhYyF2sjvZzbni8rt4QttZL0Te2kKZ&index=7']#'https://www.youtube.com/watch?v=MKWJepzv2T0']#'https://www.youtube.com/watch?v=bj6tDXBSt1g']#https://www.youtube.com/watch?v=cXQ3UV-GLkI']
import os
os.environ['PYTHONIOENCODING'] = 'utf-8'

def rename_files_in_directory(directory_path):
    try:
        # Get all files in the directory
        for filename in os.listdir(directory_path):
            file_path = os.path.join(directory_path, filename)
            
            # Check if it's a file (not a subdirectory)
            if os.path.isfile(file_path):
                # Replace spaces with underscores in the filename
                new_filename = filename.replace(u'\u29f8','').replace(u'\uff0c','').replace(' ', '_').replace("'",'')
                
                # Create the new file path
                new_file_path = os.path.join(directory_path, new_filename)
                
                # Rename the file
                os.rename(file_path, new_file_path)
                print(f"Renamed: {filename} -> {new_filename}")
                
    except Exception as e:
        print(f"Error: {e}")

def get_set_of_all_audio_files(directory_path):
    files = []
    for filename in os.listdir(directory_path):
        file_path = os.path.join(directory_path, filename)
        # Check if it's a file (not a subdirectory)
        if os.path.isfile(file_path):
            files.append(file_path)
    return files

def set_minus_audio_files(old_files, new_files):
    for file in new_files:
        if old_files.count(file) == 0:
            return file
    raise "There is no difference in this set of files"

def transform_track_add_to_database(filepath):
    pid = os.getpid()
    filepath = filepath.replace('audio\\', '')
    artists = []
    artist_found = False
    # Try and parse out the artists if applicable
    if os.path.exists(f'{pid}-artists.txt'):
        with open(f'{pid}-artists.txt', 'r') as file:
            raw_data = file.read()
            artists = raw_data.replace(';', ', ').replace(' ', '_')
            artist_found = True
        os.remove(f'{pid}-artists.txt')
    # Try to get the real artist name
    artist, title = get_artist_and_trackname(filepath, artists)
    if artist_found:
        artist = artists
    new_path = f"audio\\{artist}-{title}.wav".replace(' ', '_')
    artist = artist.replace('_', ' ')
    title = title.replace('_', ' ')
    # Rename the file
    os.rename(f"audio\\{filepath}", new_path)
    # Match the sql schema
    new_path = new_path.replace("audio\\","")
    # Grab tags
    # tags = info['info_dict']['tags']
    tags = get_emotional_tags_for_track(new_path)
    # Check if artist track exist already
    conn = connect_to_database()
    cursor = conn.cursor()
    cursor.execute(f"SELECT * FROM `test-streaming`.resources WHERE title = '{title}' AND artist = '{artist}'")
    results = cursor.fetchall()
    if len(results) == 0:
        # Upload data
        cursor.execute(f"INSERT INTO `test-streaming`.resources (artist, title, path, release_dt, insert_dt, update_dt) VALUES ('{artist}', '{title}', '{new_path}', '{datetime.datetime.now()}', '{datetime.datetime.now()}', '{datetime.datetime.now()}')")
        conn.commit()          
    else:
        print("RESOURCE EXISTS")
        print(results)
    
    # Add Tags
    for tag in tags:
        sql = f"INSERT INTO `test-streaming`.tags (artist, title, resource_path, tag) VALUES ('{artist}', '{title}', '{new_path}', '{tag}')"
        try:
            cursor.execute(sql)
        except:
            print('Exists already')
        conn.commit()

    cursor.close()
    conn.close()
    pass

if __name__ == '__main__':
    pid = os.getpid()
    # Check if URL is provided as a command-line argument
    if len(sys.argv) < 2:
        print("Usage: python script.py <URL>")
        sys.exit(1)

    # Get the URL from command-line arguments
    video_url = [sys.argv[1]]
    #video_url = "https://www.youtube.com/watch?v=aoTQQVqbYaQ"

    # Get the name of all current tracks
    current_files = get_set_of_all_audio_files("audio")

    # Add the new track
    ydl_opts = {
        'cookiefile': 'www.youtube.com.txt',  # Path to your cookies.txt
        'format': 'wav/bestaudio/best',
        #'outtmpl': '%(artist)s-%(title)s.%(ext)s'.replace(' ', '_'),  # Output template for artist - title
        # ℹ️ See help(yt_dlp.postprocessor) for a list of available Postprocessors and their arguments
        'postprocessors': [{  # Extract audio using ffmpeg
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
        }],
        'paths': {
            'home': 'audio'
        },
        #'progress_hooks': [test],
        'postprocessor_hooks': [on_finish_extracting_audio]
    }
    # This will add one file at the end of processing we know that
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        error_code = ydl.download(video_url)
    
    # The new file has been added, now lets modify it and then publish it to the database
    # First get the new files
    new_files = get_set_of_all_audio_files("audio")
    # Get the different file
    try:
        target_file = set_minus_audio_files(current_files, new_files)
        transform_track_add_to_database(target_file)
    except:
        exit(1)
    #rename_files_in_directory("audio")
    exit(0)