import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

type Data = {
  data: any
};


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  const auth = new google.auth.JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY?.split(String.raw`\n`).join('\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheet = google.sheets('v4');
  const rawCanton = (
    await sheet.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      auth: auth,
      range: 'Master!A:A',
    })
  ).data.values;
  const rawCommune = (
    await sheet.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      auth: auth,
      range: 'Master!B:B',
    })
  ).data.values;
  const rawInterest:any = (
    await sheet.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      auth: auth,
      range: process.env.RANGE_INTEREST,
    })
  ).data.values;

  const Interest = rawInterest[0];

  const Canton = rawCanton?.reduce((total: Array<string>, [curr]: string[]) => {
    return curr && !total.includes(curr) && curr != 'Canton'
      ? [...total, curr]
      : total;
  }, []);

  const Commune = rawCommune?.reduce(
    (total: Array<string>, [curr]: string[]) => {
      return curr && !total.includes(curr) && curr != 'Commune'
        ? [...total, curr]
        : total;
    },
    [],
  );

  let id_interest = 0;
  let id_canton = 0;
  let id_commune = 0;

  const return_data = {
    Interest: Interest?.reduce((total: Array<any>, item: String) => {
      return [...total, { name: item, id: id_interest++ }];
    }, []),
    Canton: Canton?.reduce((total: Array<any>, item: String) => {
      return [...total, { name: item, id: id_canton++ }];
    }, []),
    Commune: Commune?.reduce((total: Array<any>, item: String) => {
      return [...total, { name: item, id: id_commune++ }];
    }, []),
  };

  res.status(200).json({
    data : return_data
  });
}
