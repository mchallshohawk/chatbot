import { FILTER_SELECT_ONCHANGE_1, FILTER_SELECT_ONCHANGE_2, FILTER_SELECT_ONCHANGE_3 } from 'config/const'
const filterInitialState = {
    Interest: [],
    Canton: [],
    Commune: []
};

export default function reducer(state = filterInitialState, action: { type: string; payload: any; }) {
    switch (action.type) {
        case FILTER_SELECT_ONCHANGE_1:
            state.Interest = action.payload;
            return state;
        case FILTER_SELECT_ONCHANGE_2:
            state.Canton = action.payload;
            return state;
        case FILTER_SELECT_ONCHANGE_3:
            state.Commune = action.payload;
            return state;
        default:
            return state;
    }
}