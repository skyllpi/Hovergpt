import os
from crewai import Agent, LLM
from dotenv import load_dotenv
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound

# Load environment variables
load_dotenv()
groq_api_key = os.getenv("GROQ_API_KEY")

# Initialize LLM
llm = LLM(model="groq/llama-3.3-70b-versatile")  # Use a valid Groq model

# Function to fetch YouTube transcript
def fetch_youtube_transcript(video_id):
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return " ".join([entry['text'] for entry in transcript])
    except TranscriptsDisabled:
        return "Transcripts are disabled for this video."
    except NoTranscriptFound:
        return "No transcript found for this video."
    except Exception as e:
        return f"An error occurred while fetching the transcript: {str(e)}"

# Define agents
transcripts_agent = Agent(
    role="Transcript fetcher",
    goal="Fetch the transcript of a YouTube video",
    backstory="An expert in extracting data from YouTube videos.",
    llm=llm
)

summarizer = Agent(
    role="Summarizer",
    goal="Generate a concise summary of the video transcript",
    backstory="A great summarizer providing short and concise summaries of whole video transcripts.",
    llm=llm
)