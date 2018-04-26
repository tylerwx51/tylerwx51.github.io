import pandas as pd
import numpy as np


marvel = pd.read_csv('marvel_comic.csv')
dc = pd.read_csv('dc_comic.csv')

marvel['world'] = 'Marvel'
dc['world'] = 'DC'

marvel['shift'] = np.random.uniform(0, 0.1, size=marvel.shape[0])
dc['shift'] = np.random.uniform(-0.1, 0, size=dc.shape[0])

marvel.rename({'Year': 'YEAR'}, axis=1, inplace=True)

heros = pd.concat([marvel, dc], axis=0)
heros.columns


def labelEncode(data, col):
    vals = data[col].unique()
    lookup = pd.Series(index=vals, data=np.arange(0, vals.shape[0]))
    return data.assign(**{col + '_id': data[col].map(lookup)})


nan_fills = {
    'ALIGN': 'Unknown',
    'ALIVE': 'Unknown',
    'EYE': 'Unknown',
    'GSM': 'Heterosexual / Unknown',
    'HAIR': 'Unknown',
    'SEX': 'Unknown',
    'ID': 'Unknown'}

heros.fillna(nan_fills, inplace=True)


for k in ['ALIGN', 'EYE', 'HAIR', 'SEX', 'GSM', 'ALIVE', 'world', 'YEAR', 'ID']:
    heros = labelEncode(heros, k)
    heros[k + '_id'] = heros[k + '_id'] + heros['shift']

heros.to_csv('comic_data_2.csv')
heros.columns
heros.urlslug
