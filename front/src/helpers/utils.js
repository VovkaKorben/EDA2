export const API_URL = 'http://localhost:3100/api/';

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
    HOVERED: '#ff000055',
    SELECTED: '#ff0000'
});