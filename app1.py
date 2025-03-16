from crewai import Crew
import streamlit as st
from agents1 import transcripts_agent, summarizer, fetch_youtube_transcript
from task1 import transcripts_fetch_task, summarize_task
import re

# Streamlit app title
st.title("YouTube Video Summarizer")

# Function to extract video ID from YouTube URL
def extract_video_id(url):
    # Regex to extract video ID from YouTube URL
    regex = r"(?:v=|\/)([0-9A-Za-z_-]{11})"
    match = re.search(regex, url)
    if match:
        return match.group(1)
    return None

# Create the crew
video_summary_crew = Crew(
    agents=[transcripts_agent, summarizer],
    tasks=[transcripts_fetch_task, summarize_task],
)

# Input fields
url = st.text_input("Enter your YouTube URL here")

if url:
    video_id = extract_video_id(url)
    if video_id:
        # Fetch transcript first
        transcript = fetch_youtube_transcript(video_id)
        if "disabled" in transcript or "not found" in transcript or "error" in transcript:
            st.error(transcript)  # Display error message if transcript is unavailable
        else:
            # Execute the crew
            result = video_summary_crew.kickoff(inputs={"video_id": video_id})
            st.write("### Transcript")
            st.write(transcript)
            st.write("### Summary")
            st.write(result)
    else:
        st.error("Invalid YouTube URL. Please enter a valid URL.")