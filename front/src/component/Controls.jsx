import React from 'react';


const buttonsCodes = [


    { actionId: 1, caption: 'Load', ico: 'open' },
    { actionId: 5, caption: 'Save', ico: 'save' },

    { actionId: 20, caption: 'Clear all', ico: 'clear_all' },
    { actionId: 21, caption: 'Clear wires', ico: 'clear_wires' },

    { actionId: 3, caption: 'Reset view', ico: 'view' },
    { actionId: 300, caption: 'Route', ico: 'route' },
    { actionId: 400, caption: 'log wires', ico: '' },
    { actionId: 410, caption: 'log lib', ico: '' }
]

const ControlButton = ({ text, onClick, ico }) => {
    return (
        <div
            onClick={onClick}
            className="control-button frcc">
            {ico && <img src={`./${ico}.svg`} />}
            {text}
        </div>
    );
}

const Controls = ({ onAction }) => {
    return (
        <React.Fragment>

            {buttonsCodes.map((e) => {
                return <ControlButton
                    key={e.actionId}
                    text={e.caption}
                    ico={e.ico}
                    onClick={() => onAction(e.actionId)}

                />

            })


            }
        </React.Fragment>



    );
};
export default Controls;

