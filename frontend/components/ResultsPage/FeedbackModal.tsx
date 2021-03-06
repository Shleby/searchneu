import React, { useState, useEffect, useRef } from 'react';
import LogoInput from '../images/LogoInput';
import CheckboxGroup from './CheckboxGroup';
import macros from '../macros';
import useFeedbackSchedule from './useFeedbackSchedule';

export default function FeedbackModal() {
  const [open, setOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const modalRef = useRef(null);
  const keyString = 'MODAL'
  const [show, setFinished] = useFeedbackSchedule(keyString, 86400000);

  const feedbackOptions = ['Class time', 'Professor', 'Prereqs', 'Something else'];

  const handleClickOutside = (e) => {
    if (modalRef.current.contains(e.target)) {
      return;
    }
    setOpen(false);
  }

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);


  return (
    show
    && (
    <div ref={ modalRef } className='FeedbackModal'>
      {open && (
      <div className='FeedbackModal__popout'>
        <div className='FeedbackModal__popoutHeader'>
          <p>SearchNEU Feedback</p>
        </div>
        <div className='FeedbackModal__popoutSubHeader'>
          <p>What info are you looking for?</p>
        </div>
        <div className='FeedbackModal__checkBoxes'>
          <CheckboxGroup name='FeedbackModalCheckboxes' value={ selectedFeedback } onChange={ setSelectedFeedback }>
            {(Checkbox) => (
              <>
                {feedbackOptions.map((feedbackOption) => (
                  <div key={ feedbackOption } className='FeedbackModal__checkboxElement'>
                    <label className='FeedbackModal__checkboxText'>
                      <Checkbox value={ feedbackOption } />
                      <span className='FeedbackModal__checkboxBox' />
                      {feedbackOption}
                    </label>
                  </div>
                ))}
              </>
            )}
          </CheckboxGroup>
        </div>
        <div className={ !submitted ? 'FeedbackModal__submit' : 'FeedbackModal__submit--submitted' } role='button' tabIndex={ 0 } onClick={ () => { setSubmitted(true); setFinished(); macros.logAmplitudeEvent('Feedback modal submit', { lookingFor: selectedFeedback }); } }>
          <p>{!submitted ? 'SEND FEEDBACK' : 'THANK YOU!' }</p>
        </div>
      </div>
      ) }
      <div className='FeedbackModal__pill' role='button' tabIndex={ 0 } onClick={ () => { setOpen(!open) } }>
        <LogoInput height='14' width='18' fill='#d41b2c' />
        <p>SearchNEU Feedback</p>
      </div>
    </div>
    )


  );
}
