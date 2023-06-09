import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import styles from '@/styles/Home.module.css';
import { Message } from '../types/chat';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '../components/ui/LoadingDots';
import { Document } from 'langchain/document';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../components/ui/accordion';
import { useSelector } from 'react-redux';
import { multiselectFilterProps } from '../utils/interface';
import axios from 'axios';
import { LucideAirVent, Underline } from 'lucide-react';
import React from 'react';

export default function Home() {
  const filter = useSelector((state: { filter: any }) => state.filter);
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [sourceDocs, setSourceDocs] = useState<Document[]>([]);
  const [summaryDocs, setSummaryDocs] = useState<string>('')
  const [error, setError] = useState<string | null>(null);
  const [filterOptions, setFilterOption] = useState<multiselectFilterProps>({
    Interest: [],
    Canton: [],
    Commune: []
  });
  const [messageState, setMessageState] = useState<{
    messages: Message[];
    pending?: string;
    history: [string, string][];
    pendingSourceDocs?: any[];
    pendingSummaryDocs?: any[];
  }>({
    messages: [],
    history: [],
    pendingSourceDocs: [],
    pendingSummaryDocs: []
  });

  const { messages, pending, history, pendingSourceDocs, pendingSummaryDocs } = messageState;

  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);



  //handle form submission
  async function handleSubmit(e: any) {
    e.preventDefault();

    setError(null);

    if (!query) {
      alert('Please input a question');
      return;
    }

    const question = query.trim();

    setMessageState((state) => ({
      ...state,
      messages: [
        ...state.messages,
        {
          type: 'userMessage',
          message: question,
        },
      ],
      pending: undefined,
    }));

    setLoading(true);
    setQuery('');
    setMessageState((state) => ({ ...state, pending: '' }));

    const ctrl = new AbortController();

    try {
      fetchEventSource('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          history,
          filter,
        }),
        signal: ctrl.signal,
        onmessage: (event) => {
          if (event.data === '[DONE]') {
            setMessageState((state) => ({
              history: [...state.history, [question, state.pending ?? '']],
              messages: [
                ...state.messages,
                {
                  type: 'apiMessage',
                  message: state.pending ?? '',
                  sourceDocs: state.pendingSourceDocs,
                  summaryDocs: state.pendingSummaryDocs,
                },
              ],
              pending: undefined,
              pendingSourceDocs: undefined,
              pendingSummaryDocs: undefined
            }));
            setLoading(false);
            ctrl.abort();
          } else {
            const data = JSON.parse(event.data)

            if (data.summaryDocs) {
              setMessageState((state) => ({
                ...state,
                pendingSummaryDocs: (state.pendingSummaryDocs ?? '') + data.summaryDocs
              }));
              
            } else {
              setMessageState((state) => ({
                ...state,
                pending: (state.pending ?? '') + data.data,
              }));
            }

            if (data.sourceDocs) {
              setMessageState((state) => ({
                ...state,
                pendingSourceDocs: data.sourceDocs
              }));
              
            } else {
              setMessageState((state) => ({
                ...state,
                pending: (state.pending ?? '') + data.data,
              }));
            }


          }
        }
      });
    } catch (error) {
      setLoading(false);
      setError('An error occurred while fetching the data. Please try again.');
      console.log('error', error);
    }
  }

  //prevent empty submissions
  const handleEnter = useCallback(
    (e: any) => {
      if (e.key === 'Enter' && query) {
        handleSubmit(e);
      } else if (e.key == 'Enter') {
        e.preventDefault();
      }
    },
    [query],
  );

  const chatMessages = useMemo(() => {
    return [
      ...messages,
      ...(pending
        ? [
            {
              type: 'apiMessage',
              message: pending,
              sourceDocs: pendingSourceDocs,
              summaryDocs: pendingSummaryDocs
            },
          ]
        : []),
    ];
  }, [messages, pending, pendingSourceDocs, pendingSummaryDocs]);

  //scroll to bottom of chat
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [chatMessages]);

  return (
    <>
      <header className="container sticky top-0 z-40 bg-white"></header>
      <h3
        className="border-white text-2xl leading-[1.1] tracking-tighter text-center"
        style={{ marginTop: 30 + 'px' }}
      >
        Your AI search about Multi PDF files
      </h3>
      <main className={styles.main}>
        <div className={styles.cloud}>
          <div ref={messageListRef} className={styles.messagelist}>
            {chatMessages.map((message, index) => {
              let icon;
              let className;
              let label;

              if (message.type === 'apiMessage') {
                icon = (
                  <Image
                    src="/bot-image.png"
                    alt="AI"
                    width="35"
                    height="35"
                    className={styles.boticon}
                    priority
                  />
                );
                className = styles.apimessage;
                label = "See references below";
              } else {
                icon = (
                  <Image
                    src="/usericon.png"
                    alt="Me"
                    width="35"
                    height="35"
                    className={styles.usericon}
                    priority
                  />
                );
                // The latest message sent by the user will be animated while waiting for a response
                className =
                  loading && index === chatMessages.length - 1
                    ? styles.usermessagewaiting
                    : styles.usermessage;
                
                label = message.message;
              }
              return (
                <div key={index + 1}>
                  <div key={`chatMessage-${index}`} className={className}>
                    {icon}
                    <div className={styles.markdownanswer}>
                      {label}
                    </div>
                  </div>
                  {message.summaryDocs && (<div className="p-5"><p>{message.summaryDocs}</p><style jsx>{`
        p {
          margin: 0;
          padding-bottom: 10px;
        }
      `}</style></div>)}
                  {message.sourceDocs && (
                    <div className="p-5">
                      <Accordion type="single" collapsible className="flex-col">
                        {message.sourceDocs.map((doc, index) => {
                          return (
                            <div key={`messageSourceDocs-${index}`}>
                              <AccordionItem value={`item-${index}`}>
                                <AccordionTrigger>
                                  <h3>Source {index + 1}</h3>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <ReactMarkdown linkTarget="_blank">
                                    {doc[0].pageContent + 1}
                                  </ReactMarkdown>
                                  <p className="mt-2">
                                    <b>Page:</b>{' '}
                                    {
                                      <a href={doc[0].metadata.source} target="_blank">
                                        {doc[0].metadata.page + 1}
                                      </a>
                                    }
                                    <br />
                                    <b>Source:</b>{' '}
                                    {doc[0].metadata.source.startsWith(
                                      'http',
                                    ) ? (
                                      <a href={doc[0].metadata.source} target="_blank">
                                        {doc[0].metadata.source}
                                      </a>
                                    ) : (
                                      doc[0].metadata.source
                                    )}
                                  </p>
                                </AccordionContent>
                              </AccordionItem>
                            </div>
                          );
                        })}
                      </Accordion>
                    </div>
                  )}
                </div>
              );
            })}
            {sourceDocs.length > 0 && (
              <div className="p-5">
                <Accordion type="single" collapsible className="flex-col">
                  {sourceDocs.map((doc, index) => (
                    <div key={`sourceDocs-${index}`}>
                      <AccordionItem value={`item-${index}`}>
                        <AccordionTrigger>
                          <h3>Source {index + 1}</h3>
                        </AccordionTrigger>
                        <AccordionContent>
                          <ReactMarkdown linkTarget="_blank">
                            {doc.pageContent + 1}
                          </ReactMarkdown>
                        </AccordionContent>
                      </AccordionItem>
                    </div>
                  ))}
                </Accordion>
              </div>
            )}
          </div>
        </div>
        <div className={styles.center}>
          <div className={styles.cloudform}>
            <form onSubmit={handleSubmit}>
              <textarea
                disabled={loading}
                onKeyDown={handleEnter}
                ref={textAreaRef}
                autoFocus={false}
                rows={1}
                maxLength={512}
                id="userInput"
                name="userInput"
                placeholder={loading ? 'Waiting for response...' : ''}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={styles.textarea}
              />
              <button
                type="submit"
                disabled={loading}
                className={styles.generatebutton}
              >
                {loading ? (
                  <div className={styles.loadingwheel}>
                    <LoadingDots color="#000" />
                  </div>
                ) : (
                  // Send icon SVG in input field
                  <svg
                    viewBox="0 0 20 20"
                    className={styles.svgicon}
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                  </svg>
                )}
              </button>
            </form>
          </div>
        </div>
        {error && (
          <div className="border border-red-400 rounded-md p-4">
            <p className="text-red-500">{error}</p>
          </div>
        )}
      </main>

      <footer className="m-auto text-center">
        <a href="https://twitter.com/mayowaoshin">
          Powered by ArchGPT® v.0.01. All rights reserverd.
        </a>
      </footer>
    </>
  );
}
