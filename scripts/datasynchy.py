import pdb
from googleapiclient.discovery import build
import hashlib
from google.oauth2 import service_account
from urllib.request import Request, urlopen
from io import BytesIO
from datetime import datetime
import pinecone
import requests
import os
from langchain.document_loaders import OnlinePDFLoader
from langchain.document_loaders import UnstructuredURLLoader
from langchain.document_loaders import UnstructuredFileLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores import Pinecone
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.document_loaders import PyPDFLoader
from langchain.docstore.document import Document
from langchain.document_loaders import WebBaseLoader
from dotenv import load_dotenv
import json
from more_itertools import locate

from transformers import BertTokenizerFast
from collections import Counter
from sentence_transformers import SentenceTransformer

load_dotenv()


load_dotenv()
m = hashlib.md5()


SHEET_ID = os.environ["SHEET_ID"]
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
SERVICE_ACCOUNT_FILE = 'client.json'
PINECONE_INDEX_NAME = os.environ["PINECONE_INDEX_NAME"]
PINECONE_NAME_SPACE = os.environ["PINECONE_NAME_SPACE"]
RANGE = os.environ["RANGE"]

creds = service_account.Credentials.from_service_account_file(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES)
service = build('sheets', 'v4', credentials=creds)

# Contants for reading google sheet
Canton_index = 0
Commune_index = 1
url_index = 14
url_read_status = 15
presuccessUrl = []
errurl = []
interestoption = []

# Read urls from google sheet


def ReadUrls():
    global interestoption
    result = service.spreadsheets().values().get(
        spreadsheetId=SHEET_ID, range=RANGE).execute()
    interest = service.spreadsheets().values().get(
        spreadsheetId=SHEET_ID, range=os.environ["RANGE_INTEREST"]).execute()
    interestoption = interest.get('values', [])[0]
    values = result.get('values', [])
    temp = []
    i = 2
    for field in values:
        if len(field) > url_index:
            if (field[url_index].startswith('http://') or field[url_index].startswith('https://')) and ((field[Canton_index] != '') or (field[Commune_index] != '')):
                if len(field) > url_read_status:
                    if field[url_read_status] != "X":
                        temp.append(field)
                        presuccessUrl.append(i)
                else:
                    temp.append(field)
                    presuccessUrl.append(i)

        i += 1
    # print("prescuu--", presuccessUrl, temp)
    return temp


def SyncUrls(urls):
    print("Loading from urls....")
    mark = []
    successUrl = presuccessUrl.copy()
    # i = 0
    for i, url in enumerate(urls):
        print(i, url)
        text = ""
        r = requests.get(url[url_index])
        if ('application/pdf' in r.headers["content-type"]):
            print("PDF")
            text = PDF2Text(url, i)
        elif 'text/html' in r.headers["content-type"]:
            print("HTML")
            text = HTML2Text(url, i)
        # i += 1
        if text != "":
            Learning(text, url)
    errurl.reverse()
    for err in errurl:
        presuccessUrl.pop(err)

    if len(presuccessUrl):
        i = 2
        j = 0
        while i <= presuccessUrl[len(presuccessUrl)-1]:
            if i == presuccessUrl[j]:
                j += 1
                mark.append("X")
            else:
                mark.append(None)
            i += 1
        print(mark)
        write(mark)
    print("Loading finished")


def PDF2Text(url, pos):
    data = ""
    try:
        Canton = []
        Commune = []

        loader = PyPDFLoader(url[url_index])
        data = loader.load()

        if url[Canton_index]:
            Canton.append(url[Canton_index])

        if url[Commune_index]:
            Commune.append(url[Commune_index])

        indices = list(locate(url, lambda x: x == '1'))
        interest = []
        for index in indices:
            interest.append(interestoption[index - 2])

        for meta_item in data:
            meta_item.metadata.update({
                'source': url[url_index],
                'Canton': Canton,
                'Commune': Commune,
                'Interest': interest
            })

    except Exception as e:
        errurl.append(pos)
        sttime = datetime.now().strftime('%Y-%m-%d_%H:%M:%S - ')
        with open('UnReadableFile.txt', 'a') as f:
            f.write(sttime + url[url_index] + str(e) + '\n')
        pass
    finally:
        return data


def HTML2Text(url, pos):
    data = ""
    try:
        item = []
        Canton = []
        Commune = []

        item.append(url[url_index])
        loader = UnstructuredURLLoader(urls=item)
        data = loader.load()

        if url[Canton_index]:
            Canton.append(url[Canton_index])

        if url[Commune_index]:
            Commune.append(url[Commune_index])

        indices = list(locate(url, lambda x: x == '1'))
        interest = []
        for index in indices:
            interest.append(interestoption[index - 2])

        data[0].metadata = {
            'source': url[url_index],
            'Canton': Canton,
            'Commune': Commune,
            'Interest': interest
        }

    except Exception as e:
        errurl.append(pos)
        sttime = datetime.now().strftime('%Y-%m-%d_%H:%M:%S - ')
        with open('UnReadableFile.txt', 'a') as f:
            f.write(sttime + url[url_index] + str(e) + '\n')
        pass
    finally:
        return data


def Learning(data, url):
    try:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000, chunk_overlap=200)

        docs = text_splitter.split_documents(data)
        print("docs----", docs)
        embeddings = OpenAIEmbeddings(
            openai_api_key=os.environ["OPENAI_API_KEY"])

        index = pinecone.Index(index_name=PINECONE_INDEX_NAME)
        pinecone.init(
            api_key=os.environ["PINECONE_API_KEY"],
            environment=os.environ["PINECONE_ENVIRONMENT"]
        )

        ids = []
        texts = []
        metadatas = []
        for i, doc in enumerate(docs):
            m.update(url[url_index].encode('utf-8'))
            uid = m.hexdigest()[:12]
            ids.append(f"{uid}-{i}")
            texts.append(doc.page_content)
            metadatas.append(doc.metadata)
        Pinecone.from_texts(texts=texts, ids=ids, embedding=embeddings, metadatas=metadatas,
                            index_name=PINECONE_INDEX_NAME, namespace=PINECONE_NAME_SPACE)
        # Pinecone.from_documents(
        #     docs, embeddings,  index_name=PINECONE_INDEX_NAME, namespace=PINECONE_NAME_SPACE)

        print("Stored One Doc")
    except Exception as e:
        print(str(e))


def write(mark):
    request = service.spreadsheets().values().update(spreadsheetId=SHEET_ID, range='Master!P1', valueInputOption="USER_ENTERED", body={
        "majorDimension": "COLUMNS",
        "values": [ mark ]
    })
    response = request.execute()


def SyncLocal():
    entries = os.listdir('../docs/')

    for entry in entries:
        path = '../docs/' + entry
        try:
            loader = PyPDFLoader(path)
            rawTxt = loader.load()
            Learning(rawTxt, path)
        except Exception as e:
            sttime = datetime.now().strftime('%Y-%m-%d_%H:%M:%S - ')
            with open('UnReadableFile.txt', 'a') as f:
                f.write(sttime + path + str(e) + '\n')





contexts = []
# loop through the context passages
for record in pubmed['context']:
    #join context passage for each question and append to contexts list
    contexts.append('\n'.join(record['context']))
# view some of the contexts
for context in contexts[:2]:
    print(f"{context[:300]}...")

#load bert tokenizer from huggingface
tokenizer = BertTokenizerFast.from_pretrained(
    'bert-base-uncased'
)

# tokenize the context passage
inputs = tokenizer(
    contexts[0], padding=True, truncation=True, max_length=512
)
inputs.keys()

#extract the input ids
input_ids = inputs['input_ids']

#convert the input_ids list to a dictionary of key to frequency values
sparse_vec = dict(Counter(input_ids))

# load a sentence transformer model from huggingface
model = SentenceTransformer(
    'multi-qa-MiniLM-L6-cos-v1',
    device='cuda'
)

emb = model.encode('hello world')

# initialize an instance of HybridPinecone class
pinecone = HybridPinecone(
    api_key = os.environ["PINECONE_API_KEY"],
    environment=os.environ["PINECONE_ENVIRONMENT"]
)

# create the index
pinecone.create_index(
    index_name = os.environ["PINECONE_INDEX_NAME"],
    dimension = 384,
    metric = "dotproduct",
    pod_type = "s1h"
)


def build_dict(input_batch):
    #store a batch of sparse embeddings
    sparse_emb = []
    # iterate through input batch
    for token_ids in input_batch:
        # convert the input_ids list to a dictionary of key to frequency values
        d = dict(Counter(token_ids))
        # remove special tokens and append sparse vectors to sparse_emb list
        sparse_emb.append({
            key: d[key] for key in d if key not in [101, 102, 103, 0]
        })
        # return sparse)emb list
        return sparse_emb

def generate_sparse_vectors(context_batch):
    #create batch of input-ids
    inputs = tokenizer(
        context_batch, padding=True, truncation=True, max_length=512
    )
    # create sparse dictionaries
    sparse_embeds = build_dict(inputs)
    return sparse_embeds



if __name__ == '__main__':
    urls = ReadUrls()
    SyncUrls(urls)
    # SyncLocal()
