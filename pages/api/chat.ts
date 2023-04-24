import type { NextApiRequest, NextApiResponse } from 'next';
import { OpenAIEmbeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { Configuration, OpenAIApi } from "openai";
import { PineconeClient } from "@pinecone-database/pinecone";
import { OpenAIChat } from "langchain/llms";
import { loadQAStuffChain, loadQAChain } from 'langchain/chains';
import { PromptTemplate } from "langchain/prompts";
import { CallbackManager } from "langchain/callbacks";

export default async function handler( req: NextApiRequest, res: NextApiResponse) {

    const SYSTEM_TEMPLATE = PromptTemplate.fromTemplate(
        `Please answer with 5 sentences. pLease insert <br> each sentence.
        {chat_history}
          Question: {question}
          =========
          {context}
          =========
          Answer in Markdown:`,
      );

    const { question, history, filter } : {
            question: string; history: string; filter: any; } = req.body;

    if (!question) {
        return res.status(400).json({
            message: 'No question in the request'
        });
    }

    // OpenAI recommends replacing newlines with spaces for best results
    const sanitizedQuestion = question.trim().replaceAll('\n', ' ');

    // Initialize Pinecone
    const client = new PineconeClient();
    await client.init({
        apiKey: process.env.PINECONE_API_KEY ?? "",
        environment: process.env.PINECONE_ENVIRONMENT ?? "",
    });


    const pineconeIndex = client.Index(process.env.PINECONE_INDEX_NAME ?? "");
    const vectorStore = await PineconeStore.fromExistingIndex(
        new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY
        }), {
        pineconeIndex,
        namespace: process.env.PINECONE_NAME_SPACE
    });

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
    });

    const sendData = (data: string) => {
        res.write(`data: ${data}\n\n`);
    };

    sendData(JSON.stringify({ data: '' }));

    // Initialize OpenAI
    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);


    try {

        const llm = new OpenAIChat({
            temperature: 0,
            modelName: 'gpt-3.5-turbo',
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0,
            openAIApiKey: process.env.OPENAI_API_KEY,
            streaming: true,
            callbackManager: CallbackManager.fromHandlers({
            async handleLLMNewToken(token: string) {
              sendData(JSON.stringify({ summaryDocs: token }));
            },
          }),
        });

        const score_data: [any, number][] = await vectorStore.similaritySearchWithScore(sanitizedQuestion, 3);


        const score_data1 = await vectorStore.similaritySearch(sanitizedQuestion, 10)

        let output = score_data.filter(([doc, score]: (any | number)[]) => {
            if (Number(score) > 0.5)
                return true;
            return false;
        });

        const chainA = loadQAChain(llm, {
            type: "stuff",
            prompt: SYSTEM_TEMPLATE,
          });
        let resA = await chainA.call({
            question: sanitizedQuestion,
            input_documents: score_data1,
            chat_history: []
        });

        //if there are no similarities, clear output and also make normal call for ChatGPT to answer the generically question without any vector
        if (output.length === 1000) {

            const OpenAI_response = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: [{ 
                    role: "system", 
                    content: "You are ArchGPT" 
                },
                { 
                    role: "user", 
                    content: sanitizedQuestion}]
            });

            const chat_result = OpenAI_response.data.choices[0]?.message?.content;

            sendData(JSON.stringify({
                data: chat_result
            }));
			
        } else {
            let resB = "See references below"
            sendData(JSON.stringify({
                data: resB
            }));

            sendData(JSON.stringify({
                sourceDocs: output
            }));  
            
            sendData(JSON.stringify({
                summaryDocs: resA.text
            }));
        }

    } catch (error) {
        console.log('error', error);
    } finally {
        sendData('[DONE]');
        res.end();
    }
}
