import re
from googleapiclient.discovery import build
from google.oauth2 import service_account
from datetime import datetime
import pinecone
import requests
import os
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores import Pinecone
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.document_loaders import PyPDFLoader
from dotenv import load_dotenv

load_dotenv()

# Defines constants
SHEET_ID = os.environ["SHEET_ID"]
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SERVICE_ACCOUNT_FILE = 'client.json'
PINECONE_INDEX_NAME = os.environ["PINECONE_INDEX_NAME"]
PINECONE_NAME_SPACE = os.environ["PINECONE_NAME_SPACE"]
RANGE = os.environ["RANGE"]


# Access Google sheets with Google APIS
creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)
service = build('sheets', 'v4', credentials=creds)


# Contants for reading google sheet
TITLE_INDEX = 0
TYPE_INDEX = 1
URL_INDEX = 2
DESTINATION = '../docs/'

# Global variables
PDFURLS = []


# Read urls from google sheet
def ReadUrls():
    global PDFURLS

    result = service.spreadsheets().values().get(
        spreadsheetId=SHEET_ID, range=RANGE).execute()

    values = result.get('values', [])
    temp = []

    for field in values:
        if (field[URL_INDEX].startswith('http://') or field[URL_INDEX].startswith('https://')):
            temp.append(field)

    PDFURLS = [i[URL_INDEX] for i in temp]
    return temp


# Synchronize Urls from Googlesheets
def SyncUrls(urls):
    print("Loading from urls....")

    for url in urls:
        text = ""
        r = requests.get(url[URL_INDEX])
        t = url[TYPE_INDEX]

        if t == "GDRIVE":
            print("GDRIVE")
            download_file_from_google_drive(url[URL_INDEX])
        if text != "":
            Learning(text)

    print("Loading finished")


# Convert PDF to Text
def PDF2Text(url, pos):
    data = ""
    try:

        loader = PyPDFLoader(url[URL_INDEX])
        data = loader.load()
    except Exception as e:
        sttime = datetime.now().strftime('%Y-%m-%d_%H:%M:%S - ')
        with open('UnReadableFile.txt', 'a') as f:
            f.write(sttime + url[URL_INDEX] + str(e) + '\n')
        pass
    finally:
        return data


# Download files from Google Drivers
def download_file_from_google_drive(link):
    URL = "https://docs.google.com/uc?export=download"

    x = re.search(r"\bd\/\w+[^/]([A-Za-z0-9-_])*", link)
    id = x.group()[2:]

    destination = DESTINATION + id + '.pdf'

    # extracts the unique ID of the image/file
    session = requests.Session()

    response = session.get(URL, params={'id': id}, stream=True)
    token = get_confirm_token(response)

    if token:

        params = {'id': id, 'confirm': token}
        response = session.get(URL, params=params, stream=True)

    save_response_content(response, destination)


def get_confirm_token(response):
    for key, value in response.cookies.items():
        if key.startswith('download_warning'):
            return value

    return None


def save_response_content(response, destination):

    CHUNK_SIZE = 32768

    with open(destination, "wb") as f:
        for chunk in response.iter_content(CHUNK_SIZE):
            if chunk:  # filter out keep-alive new chunks
                f.write(chunk)


def change_source_metadata(source):
    id = source.split('/')[2].split('.')[0]

    for i in PDFURLS:
        if id in i:
            return i


# Upload Vectors into Pinecone and Learning with Open AI Embeddings
def Learning(data):
    try:

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, chunk_overlap=200)

        docs = text_splitter.split_documents(data)

        for i in range(len(docs)):
            docs[i].metadata['source'] = change_source_metadata(
                docs[i].metadata['source'])

        embeddings = OpenAIEmbeddings(
            openai_api_key=os.environ["OPENAI_API_KEY"])

        index = pinecone.Index(index_name=PINECONE_INDEX_NAME)
        pinecone.init(
            api_key=os.environ["PINECONE_API_KEY"],
            environment=os.environ["PINECONE_ENVIRONMENT"]
        )
        Pinecone.from_documents(
            docs, embeddings,  index_name=PINECONE_INDEX_NAME, namespace=PINECONE_NAME_SPACE)
        print("Stored One Doc")
    except Exception as e:
        print(str(e))


# Synchronize PDF files in Local
def SyncLocal():
    entries = os.listdir('../docs/')

    for entry in entries:
        path = '../docs/' + entry

        try:
            loader = PyPDFLoader(path)
            rawTxt = loader.load()
            Learning(rawTxt)
        except Exception as e:
            sttime = datetime.now().strftime('%Y-%m-%d_%H:%M:%S - ')
            with open('UnReadableFile.txt', 'a') as f:
                f.write(sttime + path + str(e) + '\n')
                pass


if __name__ == '__main__':
    urls = ReadUrls()
    SyncUrls(urls)
    SyncLocal()
