(function (root) {
  'use strict';
  const content = typeof module === 'object' ? require('./second-test-content.js') : root.SecondTestContent;
  function interpret(answers) {
    if (!Array.isArray(answers) || answers.length !== 10 ||
        Array.from(answers).some(answer => !['A', 'B', 'C', 'D'].includes(answer))) {
      throw new Error('Ответьте на все 10 вопросов.');
    }
    const [q1,q2,q3,q4,q5,q6,q7,q8,q9,q10] = answers;
    const categories = new Set();
    const rules = content.rules.filter(rule => rule.conditions.every(([index,value]) => answers[index] === value))
      .sort((a,b) => b.priority-a.priority)
      .filter(rule => {
        if (categories.has(rule.category) || categories.size === 2) return false;
        categories.add(rule.category); return true;
      });
    const obstacles = rules.length ? rules.map(rule => rule.text) : [content.behaviorNote[q7]];
    // Existing demand must be examined before planning a new earnings experiment.
    const next = q8 === 'A' && q10 === 'C'
      ? [content.proofAction[q8], content.goalAction[q10]]
      : [content.goalAction[q10], content.proofAction[q8]];
    return {
      ruleIds: rules.map(rule => rule.id),
      sections: [
        {title:'Что происходит сейчас', paragraphs:[`${content.context[q1]} ${content.priority[q2]} ${content.criterion[q5]}`]},
        {title:'На что можно опереться', paragraphs:[`${content.strengthInterest[q3+q4]} ${content.demandEvidence[q8]}`]},
        {title:'Что может мешать', paragraphs:[`${obstacles.join(' ')} ${content.decisionStyle[q6]}`]},
        {title:'Что попробовать дальше', paragraphs:[next.join(' '), `${content.constraintAction[q9]} ${content.behaviorAction[q7]}`]}
      ]
    };
  }
  if (typeof module === 'object') module.exports = {interpret};
  else root.SecondTestEngine = {interpret};
})(globalThis);
