import React, { useEffect, useState, useRef } from 'react';
import { createAssistant, createSmartappDebugger } from '@salutejs/client';
import './App.css';
import chefIcon from './icon.png';

const initializeAssistant = (getState) => {
  if (process.env.NODE_ENV === 'development') {
    return createSmartappDebugger({
      token: process.env.REACT_APP_TOKEN || '',
      initPhrase: `Запусти ГигаШеф`,
      getState,
    });
  }
  return createAssistant({ getState });
};

export const App = () => {
  const [ingredients, setIngredients] = useState([]);

  const [recipeData, setRecipeData] = useState(null);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [isLastStep, setIsLastStep] = useState(false); // заготовленный стейт

  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const ingredientsRef = useRef(ingredients);
  ingredientsRef.current = ingredients;

  const assistantRef = useRef(null);

  useEffect(() => {
    const assistant = initializeAssistant(() => ({
      item_selector: {
        items: ingredientsRef.current.map((ing, i) => ({ number: i + 1, id: ing, title: ing })),
      },
    }));

    assistantRef.current = assistant;

    assistant.on('data', (event) => {
      if (event.type === 'smart_app_data') {
        const action = event.action?.action || event.action || event.smart_app_data?.action;
        if (action) dispatchAssistantAction(action);
      }
    });
  }, []);

  useEffect(() => {
    // Ждем долю секунды, чтобы React успел применить класс .active-step
    const timeout = setTimeout(() => {
      const activeElement = document.querySelector('.active-step');
      if (activeElement) {
        // Плавно прокручиваем список так, чтобы шаг оказался по центру
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [activeStepIndex]);

  const dispatchAssistantAction = (action) => {
    switch (action.type) {
      case 'add_ingredient':
        setIngredients(prev => {
          const val = action.payload?.ingredient?.toLowerCase();
          return (val && !prev.includes(val)) ? [...prev, val] : prev;
        });
        break;
      case 'delete_ingredient':
        setIngredients(prev => prev.filter(ing => ing !== action.payload?.ingredient?.toLowerCase()));
        break;
      case 'clear_ingredients':
        setIngredients([]);
        setRecipeData(null);
        setActiveStepIndex(-1);
        setIsLastStep(false); 
        break;
      case 'start_loading':
        setIsLoading(true);
        setRecipeData(null);
        setActiveStepIndex(-1);
        setIsLastStep(false); 
        break;
      case 'show_recipe':
        setIsLoading(false);
        if (action.payload) {
          setRecipeData({
            title: action.payload.title || 'Рецепт от Шефа',
            ingredients: action.payload.ingredients || '',
            steps: action.payload.steps || []
          });
          setActiveStepIndex(-1);
          setIsLastStep(false);
        }
        break;
      case 'highlight_step':
        if (action.payload?.stepIndex !== undefined) {
          setActiveStepIndex(action.payload.stepIndex);
        }
    
        if (action.payload?.isLastStep !== undefined) {
          setIsLastStep(action.payload.isLastStep);
        }
        break;
      default:
        break;
    }
  };

  const handleAddClick = () => {
    if (inputValue.trim()) {
      const val = inputValue.trim().toLowerCase();
      
      if (!ingredients.includes(val)) {
        setIngredients([...ingredients, val]);
        
        assistantRef.current?.sendData({
          action: {
            action_id: 'UI_ADD_INGREDIENT',
            parameters: { ingredient: val }
          }
        });
      }
      setInputValue('');
    }
  };

  const deleteIngredient = (ing) => {
    setIngredients(prev => prev.filter(i => i !== ing));

    assistantRef.current?.sendData({
      action: {
        action_id: 'UI_DELETE_INGREDIENT',
        parameters: { ingredient: ing }
      }
    });
  };

  const handleClearClick = () => {
    setIngredients([]);
    setRecipeData(null);
    setIsLastStep(false);
    assistantRef.current?.sendData({
      action: { action_id: 'UI_CLEAR_INGREDIENTS' }
    });
  };

  const handleSearchClick = () => {
    assistantRef.current?.sendData({
      action: { action_id: 'UI_SEARCH_RECIPES' }
    });
  };

  const handlePrevStep = () => assistantRef.current?.sendData({ action: { action_id: 'UI_PREV_STEP' } });
  const handleRepeatStep = () => assistantRef.current?.sendData({ action: { action_id: 'UI_REPEAT_STEP' } });
  const handleNextStep = () => assistantRef.current?.sendData({ action: { action_id: 'UI_NEXT_STEP' } });
  
  const handleExitClick = () => {
    assistantRef.current?.sendData({ 
      action: { action_id: 'UI_EXIT' } 
    });
  };

  return (
    <div className="container tv-layout">
      <header className="header">
        <div className="logo-group">
          <img src={chefIcon} alt="ГигаШеф Лого" className="app-icon" />
          <h1 className="logo">ГигаШеф</h1>
        </div>
        <div className="input-group">
          <input 
            className="input" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddClick()}
            placeholder="Что в холодильнике?"
          />
          <button className="add-button" onClick={handleAddClick}>+</button>
        </div>
      </header>

      <main className="main-content">
        <section className="sidebar">
          <h2 className="section-title">Ваши продукты</h2>
          <div className="chip-container">
            {ingredients.length === 0 && <p className="empty-text">Список пуст</p>}
            {ingredients.map((ing) => (
              <div key={ing} className="chip">
                {ing}
                <span 
                  className="delete-chip" 
                  onClick={() => deleteIngredient(ing)}
                >
                  ×
                </span>
              </div>
            ))}
          </div>
          <div className="action-buttons">
            <button 
              className="action-btn clear-btn" 
              onClick={handleClearClick}
              disabled={ingredients.length === 0}
            >
              🗑 Очистить
            </button>
            <button 
              className="action-btn search-btn" 
              onClick={handleSearchClick}
              disabled={ingredients.length === 0 || isLoading}
            >
              🍳 Найти рецепт
            </button>
          </div>
        </section>

        <section className="recipe-section">
          {isLoading && (
            <div className="loader-container">
              <div className="spinner"></div>
              <p>Шеф подбирает специи...</p>
            </div>
          )}

          {!isLoading && !recipeData && (
            <div className="placeholder">
              <div className="placeholder-icon">🍳</div>
              <p>Добавьте продукты и нажмите <br/> <b>«Найти рецепт»</b></p>
            </div>
          )}

          {recipeData && (
            <article className="recipe-card">
              <h1 className="recipe-title">{recipeData.title}</h1>
              
              <div className="recipe-grid">
                <div className="recipe-ingredients-col">
                  <h3>Ингредиенты</h3>
                  <div className="text-content">{recipeData.ingredients}</div>
                </div>

                <div className="recipe-steps-col">
                  <h3>Приготовление</h3>
                  <div className="steps-list">
                    {recipeData.steps.map((step, index) => (
                      <div 
                        key={index} 
                        className={`step-item ${activeStepIndex === index ? 'active-step' : ''}`}
                      >
                        {step}
                      </div>
                    ))}
                  </div>

                  {/* КОМПАКТНЫЙ ПЛЕЕР */}
                  {recipeData.steps.length > 0 && (
                    <div className="compact-player">
                      <div className="player-status">
                        {activeStepIndex === -1 ? 'Готовы начать?' : `Шаг ${activeStepIndex + 1} из ${recipeData.steps.length}`}
                      </div>
                      <div className="step-controls">
                        <button className="player-btn icon-btn" onClick={handlePrevStep} title="Предыдущий шаг">
                          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                            <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
                          </svg>
                        </button>

                        <button className="player-btn icon-btn" onClick={handleRepeatStep} title="Повторить шаг">
                          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                            <path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/>
                          </svg>
                        </button>

                        {/* Условный рендеринг: Кнопка "Выйти" или "Дальше" */}
                        {isLastStep ? (
                          <button 
                            className="player-btn next-btn" 
                            onClick={handleExitClick}
                            style={{ backgroundColor: '#e53935', color: '#fff' }} // Делаем кнопку красной для акцента, можно перенести в CSS
                          >
                            Выйти
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" style={{ marginLeft: '4px' }}>
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                          </button>
                        ) : (
                          <button className="player-btn next-btn" onClick={handleNextStep}>
                            Дальше
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;