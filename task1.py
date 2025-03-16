from crewai import Task
from agents1 import transcripts_agent, summarizer, fetch_youtube_transcript

# Task to fetch the transcript
transcripts_fetch_task = Task(
    description="Fetch the transcript for the YouTube video with ID: {video_id}",
    agent=transcripts_agent,
    expected_output="A complete transcript of the video."
)

# Task to summarize the transcript with a word limit of 200 words
summarize_task = Task(
    description="Summarize the transcript data for the video with ID: {video_id} in no more than 200 words. If the transcript is not available, explain why.",
    agent=summarizer,
    expected_output="A concise and short summary of the video transcript (maximum 200 words) or an explanation if the transcript is unavailable."
)