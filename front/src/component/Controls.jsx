import React from 'react';


const buttonsCodes = [

    { id: 2, caption: 'Clear', ico: '' },
    { id: 1, caption: 'Load', ico: '' },
    { id: 5, caption: 'Save', ico: '' },

    { id: 3, caption: 'reset view', ico: '' },
    { id: 4, caption: 'log', ico: '' }
]

const ControlButton = ({ text, onClick }) => {
    return (
        <div
            onClick={onClick}
            className="control-button">
            {text}
        </div>
    );
}

const Controls = ({ onAction }) => {
    return (
        <React.Fragment>

            {buttonsCodes.map((e) => {
                return <ControlButton
                    key={e.id}
                    text={e.caption}
                    ico={e.ico}
                    onClick={() => onAction(e.id)}

                />

            })


            }
        </React.Fragment>



    );
};
export default Controls;

// <div id="control_panel">
// </div>