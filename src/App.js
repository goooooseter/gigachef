import React, { useEffect, useState, useRef } from 'react';
import { createAssistant, createSmartappDebugger } from '@salutejs/client';
import './App.css'; // Подключаем наши стили

const initializeAssistant = (getState) => {
  if (process.env.NODE_ENV === 'development') {
    return createSmartappDebugger({
      token: process.env.REACT_APP_TOKEN || '',
      initPhrase: `Запусти GigaChef`,
      getState,
    });
  }
  return createAssistant({ getState });
};

export const App = () => {
  const [ingredients, setIngredients] = useState([]);
  const [recipe, setRecipe] = useState(null);

  const [steps, setSteps] = useState([]);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);

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
        setRecipe(null);
        break;
      case 'start_loading':
        setIsLoading(true);
        setRecipe(null);
        break;
      case 'show_recipe':
        setIsLoading(false);
        if (action.payload?.recipe) {
          setRecipe(action.payload.recipe);
          setSteps(action.payload.steps || []);
          setActiveStepIndex(-1);
        }
        break;
      case 'highlight_step':
        if (action.payload?.stepIndex !== undefined) {
          setActiveStepIndex(action.payload.stepIndex);
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
  setRecipe(null);
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

  return (
    <div className="container">
      <header className="header">
        <h1 className="logo">👨‍🍳 GigaChef</h1>
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
          <h2 className="section-title">Рецепт от Шефа</h2>
          
          {isLoading && (
            <div className="loader-container">
              <div className="spinner"></div>
              <p>Шеф подбирает специи...</p>
            </div>
          )}

          {!isLoading && !recipe && (
            <div className="placeholder">
              <p>Добавьте продукты и скажите: <br/> <b>"Найди рецепт"</b></p>
            </div>
          )}

          {recipe && (
            <article className="recipe-card">
              <div className="recipe-text">{recipe}</div>
              
              {/* ПЛЕЕР ШАГОВ */}
              {steps.length > 0 && (
                <div className="step-player">
                  {activeStepIndex === -1 ? (
                    <div style={{ textAlign: 'center' }}>
                      <p>Скажите <b>«Дальше»</b> или нажмите кнопку, чтобы запустить голосовой гид по шагам.</p>
                      <button className="nav-btn primary" onClick={handleNextStep}>Начать готовку ⏩</button>
                    </div>
                  ) : (
                    <>
                      <h3>Шаг {activeStepIndex + 1} из {steps.length}</h3>
                      <p>{steps[activeStepIndex]}</p>
                      <div className="step-controls">
                        <button className="nav-btn" onClick={handlePrevStep} disabled={activeStepIndex === 0}>
                          ⏪ Назад
                        </button>
                        <button className="nav-btn" onClick={handleRepeatStep}>
                          🔁 Повторить
                        </button>
                        <button className="nav-btn primary" onClick={handleNextStep}>
                          {activeStepIndex === steps.length - 1 ? 'Завершить 🎉' : 'Дальше ⏩'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </article>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;