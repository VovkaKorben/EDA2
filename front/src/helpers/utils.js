export const API_URL = 'http://localhost:3333/api/';

export const ObjectType = Object.freeze({
    NONE: 'NONE',
    PIN: 'PIN',
    ELEMENT: 'ELEMENT',
    WIRE: 'WIRE',
    TCONN: 'TCONN',

});

export const DragModeType = Object.freeze({
    NONE: 'NONE',
    SCROLL: 'SCROLL',
    ROUTING: 'ROUTING',
    ELEMENT: 'ELEMENT'
});

export const DrawColor = Object.freeze({
    NORMAL: '#000000',
    HOVERED: '#40ff00d3',
    SELECTED: '#00ca00'
});
export const pcbColor = Object.freeze({
    BG: '#fff',
    PCB_FILL: '#00ff3c0c',
    PCB_BORDER: '#000',
    BOUND: '#750000',
    SILK: '#000',
    COPPER: '#8d5e00',
    DEBUG: '#00000035',
    ELEM: '#f00f',
    BLUE: '#0000ff44',
    DRILL: '#f50'
});

export const ErrorCodes = Object.freeze({
    INFO: 0,
    ERROR: 1,

});


export const LayerTypes = Object.freeze({
    SILKSCREEN: 'Silkscreen',
    DRILLING: 'Drilling spots',
    COPPER: 'Copper',
    BOUND: 'PCB bound',
    GRID: 'Grid',
    ELEMENTS: 'Elements Bound'
});