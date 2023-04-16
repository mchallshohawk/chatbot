import '@/styles/styles.css';
import { FC } from "react";
import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import store from "../redux/store";
import { Provider } from "react-redux";

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const MyApp: FC<AppProps> = ({ Component, ...rest }) => {
  // const { store, props } = wrapper.useWrappedStore(rest);
  // const { pageProps } = props;
  return (
    <>
      <Provider store={store}>
          <main className={inter.variable}>
            <Component />
          </main>
        </Provider>
    </>
  );
}

export default MyApp;