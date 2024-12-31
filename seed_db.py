import requests

def post_url_to_api(api_endpoint, url, headers=None):
    """
    Posts a URL to an API endpoint.
    
    Args:
        api_endpoint (str): The API endpoint to send the POST request to.
        url (str): The URL to include in the request body.
        headers (dict, optional): Additional headers to include in the request.
    
    Returns:
        Response: The response object returned by the API.
    """
    # Prepare the payload
    payload = {"url": url}
    
    # Send the POST request
    try:
        response = requests.post(api_endpoint, json=payload, headers=headers)
        response.raise_for_status()  # Raise an HTTPError for bad responses (4xx and 5xx)
        return response
    except requests.RequestException as e:
        print(f"An error occurred: {e}")
        return None

# Example usage
if __name__ == "__main__":
    videos = ['https://www.youtube.com/watch?v=dzrQCsJzr70',
              'https://www.youtube.com/watch?v=aoTQQVqbYaQ',
              'https://www.youtube.com/watch?v=Kfw_aHK8_Hk',
              'https://www.youtube.com/watch?v=XKWcAsT8Sqc',
              'https://www.youtube.com/watch?v=UyHk9yRQV7E',
              'https://www.youtube.com/watch?v=vICymCoi2e0',
              'https://www.youtube.com/watch?v=W-u6E8F0VcE',
              'https://www.youtube.com/watch?v=RLecv6aZiEk',
              'https://www.youtube.com/watch?v=bkk2H3Ztrfk',
              'https://www.youtube.com/watch?v=_JUpTOFJUTU',
              'https://www.youtube.com/watch?v=HmAsUQEFYGI',
              'https://www.youtube.com/watch?v=2GKL_ZoJQjc',
              'https://www.youtube.com/watch?v=FUXX55WqYZs',]
    api_endpoint = "http://192.168.5.217:5000/process-url"
    for video in videos:
        url_to_post = video
        headers = {
            "Content-Type": "application/json"
        }
        
        response = post_url_to_api(api_endpoint, url_to_post, headers=headers)
        if response:
            print("Response status code:", response.status_code)
            print("Response body:", response.json())
