import os
from openai import OpenAI
import json

def get_emotional_tags_for_track(trackname):
    client = OpenAI(
        api_key="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"  # This is the default and can be omitted
    )
    tries = 0
    #and the emotions you can choose from are [{emotions}]
    while True and tries < 5:
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": f"Respond with an array of 7 common emotions that can be used to compare similiar songs. The song is {trackname} . Your response should be a JSON string with the key being \"tags\" and the value the array of tags.",
                        #"content": "What are some emotions used to describe music. Your response should be a JSON string with the key being \"tags\" and the value the array of tags."
                    }
                ],
                model="gpt-3.5-turbo",
            )
            # Extract and print the response
            chatgpt_response = json.loads(chat_completion.choices[0].message.content)
            return chatgpt_response['tags']
        except:
            tries+=1
    return []

# print(get_emotional_tags_for_track('911_tyler_the_creator.wav'))

def get_artist_and_trackname(filename, artists):
    client = OpenAI(
        api_key="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"  # This is the default and can be omitted
    )
    tries = 0
    if artists == []:
        prompt = f"What is the Artist and Title of this track: {filename}? Respond with a JSON string where the keys are \"artist\" and \"title\" and their values are the artist name and track title."
    else:
        prompt = f"Extract the Title of the song from this file: {filename}? In the filename there are [] brackets with random characters between them; the title occurs before this sequence. Respond with a JSON string where the keys are \"artist\" and \"title\" and their values are the artist name (N/A) and track title."
    #and the emotions you can choose from are [{emotions}]
    while True and tries < 5:
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                        #"content": "What are some emotions used to describe music. Your response should be a JSON string with the key being \"tags\" and the value the array of tags."
                    }
                ],
                model="gpt-3.5-turbo",
            )
            # Extract and print the response
            chatgpt_response = json.loads(chat_completion.choices[0].message.content)
            return chatgpt_response['artist'], chatgpt_response['title']
        except:
            tries+=1
    return "NA", filename

#print(get_artist_and_trackname("EARFQUAKE.wav"))