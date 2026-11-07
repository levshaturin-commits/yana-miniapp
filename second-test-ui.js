(function () {
  'use strict';
  // Keep the legacy test DOM, handlers, score and copy isolated and unchanged.
  const legacy = document.querySelector('main.app:not([id])');
  const chooser = document.getElementById('testChooser');
  const host = document.getElementById('secondTest');
  if (!window.SecondTestContent || !window.SecondTestEngine || !chooser || !host) return;
  const content = window.SecondTestContent;
  const state = {answers:Array(10).fill(null), index:0, screen:'intro'};
  const telegram = window.Telegram?.WebApp;
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function button(text, action, className='secondary') {
    const node = element('button',text,className); node.type='button';
    node.addEventListener('click',action); return node;
  }
  function go(route) { window.location.hash = route; }
  function reset() { state.answers.fill(null); state.index=0; state.screen='question'; render(); }
  function back() {
    if (location.hash !== '#second') return go('');
    if (state.screen === 'result') { state.screen='question'; state.index=9; }
    else if (state.screen === 'question' && state.index > 0) state.index--;
    else if (state.screen === 'question') state.screen='intro';
    else return go('');
    render();
  }
  function render() {
    host.replaceChildren();
    const card = element('div',null,'card');
    if (state.screen === 'intro') {
      card.append(element('h1','ЧЕМ ВАМ ЗАНЯТЬСЯ ДАЛЬШЕ?'),
        element('p','10 вопросов, которые помогут разобраться в своих способностях, идеях и возможностях заработка.','lead'),
        element('p','Выбирайте один ответ, который больше всего подходит вам сейчас. Здесь нет правильных и неправильных вариантов.'),
        button('Начать',()=>{state.screen='question';render();},'primary'));
    } else if (state.screen === 'question') {
      const top=element('div',null,'top');
      top.append(element('div','Yana_Shaturina','brand'),element('div',`${state.index+1} из 10`,'progress-label'));
      const progress=element('div',null,'progress');
      progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','Прогресс теста');
      progress.setAttribute('aria-valuenow',state.index+1);progress.setAttribute('aria-valuemin',0);progress.setAttribute('aria-valuemax',10);
      const bar=element('div');bar.style.width=`${(state.index+1)*10}%`;progress.append(bar);host.append(top,progress);
      const fieldset=element('fieldset');fieldset.append(element('legend',content.questions[state.index].title));
      const options=element('div',null,'answers');
      const next=button(state.index===9?'Посмотреть результат':'Далее',()=>{
        if (!state.answers[state.index]) return;
        if (state.index<9) state.index++;
        else {
          const missing=state.answers.findIndex(answer=>!answer);
          if(missing!==-1) state.index=missing; else state.screen='result';
        }
        render();
      },'primary');
      next.disabled=!state.answers[state.index];
      content.questions[state.index].answers.forEach((text,index)=>{
        const label=element('label',null,'answer');const input=element('input');
        input.type='radio';input.name='second-answer';input.value='ABCD'[index];
        input.checked=state.answers[state.index]===input.value;
        input.addEventListener('change',()=>{state.answers[state.index]=input.value;next.disabled=false;});
        label.append(input,element('span',text));options.append(label);
      });
      fieldset.append(options);card.append(fieldset,next,button('Назад',back));
    } else {
      let result;
      try {result=window.SecondTestEngine.interpret(state.answers);}
      catch {state.index=Math.max(0,state.answers.findIndex(answer=>!answer));state.screen='question';render();return;}
      card.append(element('div','Результат','result-kicker'));
      const body=element('div',null,'result-body');
      // Emphasize existing conclusions without rewriting or duplicating result text.
      const lastSentence=text=>text.split(/(?<=[.!?])\s+/).at(-1);
      const highlights=[
        `${lastSentence(content.priority[state.answers[1]])} ${content.criterion[state.answers[4]]}`,
        lastSentence(content.demandEvidence[state.answers[7]]),
        content.decisionStyle[state.answers[5]],
        content.behaviorAction[state.answers[6]]
      ];
      result.sections.forEach((section,index)=>{
        const node=element('section');node.append(element('h2',section.title));
        section.paragraphs.forEach(text=>{
          const highlight=highlights[index];
          if(text.endsWith(highlight)) {
            const preceding=text.slice(0,-highlight.length).trimEnd();
            if(preceding) node.append(element('p',preceding));
            const summary=element('p',null,'result-summary');
            summary.append(element('strong',highlight));node.append(summary);
          } else node.append(element('p',text));
        });body.append(node);
      });card.append(body);
      appendFunnel(card);
      card.append(button('Пройти ещё раз',()=>{
        card.replaceChildren(element('p','Сбросить ответы второго теста и начать заново?'),button('Начать заново',reset,'primary'),button('Отмена',render));
      },'restart-link'));
    }
    host.append(card);
    window.scrollTo(0,0);
    const heading=host.querySelector('h1,legend,h2');
    if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }
  function appendFunnel(card) {
    const config=window.SECOND_TEST_FUNNEL;
    let valid=false;
    try {const url=new URL(config?.url);valid=url.protocol==='https:' && url.hostname==='t.me' && url.pathname!=='/' && !url.username && !url.password && typeof config.label==='string' && !!config.label.trim();} catch {}
    if(!valid) {
      const notice=element('p','Переход к следующему этапу пока не настроен.','technical-note');
      notice.setAttribute('role','status');card.append(notice);return;
    }
    const funnel=element('div',null,'funnel');
    if (Array.isArray(config.paragraphs)) {
      config.paragraphs.filter(text=>typeof text==='string').forEach(text=>{
        const paragraph=element('p');
        if(text.startsWith('Подробнее обо мне')) paragraph.append(element('strong',text));
        else paragraph.textContent=text;
        funnel.append(paragraph);
      });
    }
    const arrow=element('div','↓','funnel-arrow');arrow.setAttribute('aria-hidden','true');
    const cta=element('a',config.label,'primary');cta.href=config.url;
    cta.addEventListener('click',event=>{
      if(typeof telegram?.openTelegramLink==='function') {
        try {telegram.openTelegramLink(config.url);event.preventDefault();}
        catch { /* Native anchor remains a working fallback. */ }
      }
    });
    funnel.append(arrow,cta);card.append(funnel);
  }
  function route() {
    const current=location.hash;
    legacy.classList.toggle('hidden',current!=='#first');
    host.classList.toggle('hidden',current!=='#second');
    chooser.classList.toggle('hidden',current==='#first'||current==='#second');
    if(current==='#second') render();
    try {if(current==='#first'||current==='#second') telegram?.BackButton?.show();else telegram?.BackButton?.hide();} catch {}
    window.scrollTo(0,0);
  }
  document.getElementById('chooseFirst').addEventListener('click',()=>go('first'));
  document.getElementById('chooseSecond').addEventListener('click',()=>go('second'));
  window.addEventListener('hashchange',route);
  try {telegram?.BackButton?.onClick(back);} catch {}
  // Telegram forwards ?startapp=second through the SDK and/or this query parameter.
  // Use it only on initial entry; returning to the chooser must remain possible.
  const launch=telegram?.initDataUnsafe?.start_param || new URLSearchParams(location.search).get('tgWebAppStartParam');
  if (launch==='second' && !['#first','#second'].includes(location.hash)) {
    history.replaceState(null,'',`${location.pathname}${location.search}#second`);
  }
  route();
})();
