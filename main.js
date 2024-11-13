require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const ejs = require('ejs');
const cookieParser = require('cookie-parser');
const { Client } = require('pg');
const bodyParser = require('body-parser');
const pdf = require('pdf-parse');
const pdf2img = require('pdf2img');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = 3000;

// Middleware setup with increased request size limit
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static('public'));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'ejs');
app.set('views', 'views');

const dbClient = new Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

dbClient.connect()
  .then(() => console.log('Connected to AWS PostgreSQL database'))
  .catch(err => console.error('Database connection error:', err));

const upload = multer({ dest: 'uploads/' });

require('./config/passport-setup');

const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

app.get('/', async (req, res) => {
  try {
    const jsonData = await fs.readFile(path.join(__dirname, 'data.json'), 'utf-8');
    const parsedJsonData = JSON.parse(jsonData);
    const homeData = await fs.readFile(path.join(__dirname, 'public', 'html', 'home.txt'), 'utf-8');
    const animationPlayed = req.cookies.animationPlayed === 'true';
    const renderedHomeData = ejs.render(homeData, {
      cards: parsedJsonData.cards,
      articles: parsedJsonData.articles,
      psy_card: parsedJsonData.psy_cards,
      animationPlayed,
    });
    res.render('index', {
      user: req.user,
      data: renderedHomeData,
    });
  } catch (err) {
    console.error('Error processing request:', err);
    res.status(500).send('Error processing request');
  }
});

app.get('/write-articles', async (req, res) => {
  try {
    const textEditor = await fs.readFile(path.join(__dirname, 'public', 'html', 'textEditor.txt'), 'utf-8');
    const tinymceCdnUrl = process.env.TINYMCE_CDN;
    const renderedEditor = ejs.render(textEditor, { tinymceCdnUrl });
    res.render('index', {
      user: req.user,
      data: renderedEditor,
    });
  } catch (err) {
    console.error('Error processing /write-articles request:', err);
    res.status(500).send('Error processing request');
  }
});

app.get('/write-articles-editor', async (req, res) => {
  const code = await fs.readFile(path.join(__dirname, 'public', 'html', 'editor.txt'), 'utf-8');
  res.render('index', {
    user: req.user,
    data: code,
  });
});

app.post('/save-articles-editor', async (req, res) => {
  const { title, content, articleid } = req.body;

  if (!title || !content || !articleid) {
    return res.status(400).send('Title, content, and article ID are required');
  }

  try {
    const insertQuery = `
      INSERT INTO articleTable (articleid, title, html_content, upload_date, article_submissions)
      VALUES ($1, $2, $3, DEFAULT, $4)
    `;

    await dbClient.query(insertQuery, [articleid, title, content, false]);
    console.log('Article saved with ID:', articleid);
    res.status(201).send('Article saved successfully');
  } catch (err) {
    console.error('Error saving article:', err);
    res.status(500).send('An error occurred while saving the article');
  }
});

app.get('/write-articles-upload', async (req, res) => {
  const uploadcode = await fs.readFile(path.join(__dirname, 'public', 'html', 'upload.txt'), 'utf-8');
  res.render('index', {
    user: req.user,
    data: uploadcode,
  });
});

app.post('/save-articles-upload', async (req, res) => {
  const { title, file, articleId } = req.body;
  if (!title || !file || !articleId) {
    return res.status(400).json({ message: 'Missing title, file, or article ID' });
  }
  try {
    const pdfBuffer = Buffer.from(file, 'base64');
    const pdfPath = path.join(__dirname, `${articleId}.pdf`);
    await fs.writeFile(pdfPath, pdfBuffer);
    const dataBuffer = await fs.readFile(pdfPath);
    const pdfData = await pdf(dataBuffer);
    await fs.unlink(pdfPath);
    const insertQuery = `
      INSERT INTO articleTable (articleid, title, html_content, article_submissions)
      VALUES ($1, $2, $3, $4)
    `;
    await dbClient.query(insertQuery, [articleId, title, pdfData.text, false]);
    res.status(200).json({ message: 'Article saved successfully' });
  } catch (error) {
    console.error('Error processing the PDF:', error);
    res.status(500).json({ message: 'Error processing the PDF or saving to the database' });
  }
});

app.get('/article', async (req, res) => {
  try {
    const jsonData = await fs.readFile(path.join(__dirname, 'public', 'articlesData.json'), 'utf-8');
    const articlesData = JSON.parse(jsonData).articles;
    const page = parseInt(req.query.page) || 1;
    const articlesPerPage = 6;
    const startIndex = (page - 1) * articlesPerPage;
    const endIndex = startIndex + articlesPerPage;
    const paginatedArticles = articlesData.slice(startIndex, endIndex);
    const totalPages = Math.ceil(articlesData.length / articlesPerPage);
    const htmlTemplate = await fs.readFile(path.join(__dirname, 'public', 'html', 'articles.txt'), 'utf-8');
    const articlesPage = ejs.render(htmlTemplate, {
      articles: paginatedArticles,
      currentPage: page,
      totalPages: totalPages,
    });
    res.render('index', {
      user: req.user,
      data: articlesPage,
    });
  } catch (err) {
    console.error('Error processing /articles request:', err);
    res.status(500).send('Error processing request');
  }
});

app.get('/article/:title', async (req, res) => {
  try {
    const articleTitle = req.params.title;
    const sanitizedTitle = articleTitle.replace(/[^a-zA-Z0-9 ]/g, '-').replace(/:/g, '-') + '.json';
    const articleData = await fs.readFile(path.join(__dirname, 'public', 'articles', sanitizedTitle), 'utf-8');
    const article = JSON.parse(articleData);
    const codeTemplate = await fs.readFile(path.join(__dirname, 'public', 'html', 'readArticles.txt'), 'utf-8');
    const renderedHtml = ejs.render(codeTemplate, {
      title: article.title,
      content: article.description,
      pfp: article.pfp,
      name: article.name,
      date: article.date
    });
    res.send(renderedHtml);
  } catch (err) {
    console.error('Error reading article file:', err);
    res.status(404).send('Article not found');
  }
});


app.get('/mentors', async (req, res) => {
  try {
    // Read and parse the mentor data file
    const mentorData = await fs.readFile(path.join(__dirname, 'public', 'mentors.json'), 'utf-8');
    const parsedMentorData = JSON.parse(mentorData);

    // Read the EJS template file for rendering mentor cards
    const mentorTemplate = await fs.readFile(path.join(__dirname, 'public', 'html', 'mentors.txt'), 'utf-8');

    // Render the mentor data with EJS
    const renderedMentorData = ejs.render(mentorTemplate, {
      mentors: parsedMentorData
    });

    // Send the rendered data to the main index view
    res.render('index', {
      data: renderedMentorData
    });
  } catch (err) {
    console.error('Error processing request:', err);
    res.status(500).send('Error processing request');
  }
});
app.get('/send-message',async (req,res)=>{
  try{
    let input;
    let output;
    const message = req.body.message;
    if (global.conversationHistory) {
      global.conversationHistory += `input: ${message}, `;
    } else {
      global.conversationHistory = `input: ${message}, `;
    }
    console.log(message);
    const {
      GoogleGenerativeAI,
      HarmCategory,
      HarmBlockThreshold,
    } = require("@google/generative-ai");
    
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });
    
    const generationConfig = {
      temperature: 1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "",
    };
    
    async function run() {

      const parts = [
        {text: "input Constant worry about everyday things, feeling on edge, difficulty concentrating, muscle tension, racing heart, trouble sleeping, fatigue, restlessness, irritability."},
        {text: "output generalized Anxiety Disorder (GAD)"},
        {text: "input Persistent low mood, lack of energy, loss of interest in activities, significant changes in sleep patterns (sleeping too much or too little), weight loss or changes in appetite, feelings of worthlessness or excessive guilt, and difficulty concentrating."},
        {text: "output Major Depressive Disorder (MDD)"},
        {text: "input Flashbacks and nightmares related to a traumatic event, avoidance of places or activities that remind of the event, hypervigilance, feeling detached from others, trouble sleeping, irritability, and intense feelings of distress when reminded of the trauma."},
        {text: "output Post-Traumatic Stress Disorder (PTSD)"},
        {text: "input Recurrent unwanted thoughts (obsessions), repetitive behaviors or rituals (compulsions) to ease anxiety, fear of contamination or germs, constantly checking things, and spending excessive time on tasks."},
        {text: "output Obsessive-Compulsive Disorder (OCD)"},
        {text: "input Periods of elevated mood (mania) with increased energy, decreased need for sleep, risky behavior, followed by depressive episodes with low mood, lack of interest, fatigue, and feelings of guilt or worthlessness."},
        {text: "output Bipolar Disorder"},
        {text: "input Intense fear of social situations, avoiding gatherings, feeling excessively self-conscious, sweating or trembling in social settings, racing heart, and fear of being judged or embarrassed."},
        {text: "output Social Anxiety Disorder"},
        {text: "input Sudden and repeated panic attacks, racing heart, shortness of breath, feeling out of control, intense fear of another attack, chest pain, and feeling detached from reality during episodes."},
        {text: "output Panic Disorder"},
        {text: "input Difficulty focusing or staying organized, trouble following through with tasks, impulsivity, fidgeting or restlessness, easily distracted, forgetfulness, and trouble completing detailed work."},
        {text: "output Attention Deficit Hyperactivity Disorder (ADHD)"},
        {text: "input Hallucinations (hearing or seeing things that aren’t there), delusions, disorganized thinking, lack of motivation, flat affect, withdrawal from social interactions, and trouble with daily functioning."},
        {text: "output Schizophrenia"},
        {text: "input Intense mood swings, unstable relationships, fear of abandonment, impulsive behavior, feelings of emptiness, difficulty controlling anger, and frequent feelings of being misunderstood or mistreated."},
        {text: "output Borderline Personality Disorder (BPD)"},
        {text: "input Presence of two or more distinct identities or personality states, gaps in memory for everyday events, feeling detached from oneself, severe stress, confusion about identity, and recurrent episodes of amnesia."},
        {text: "output Dissociative Identity Disorder (DID)"},
        {text: "input Extreme fear of gaining weight, significant weight loss, restrictive eating habits, distorted body image, preoccupation with food and dieting, excessive exercise, and denial of the seriousness of low body weight."},
        {text: "output Anorexia Nervosa"},
        {text: "input Episodes of binge eating followed by compensatory behaviors like vomiting or excessive exercise, feeling a lack of control during binge episodes, preoccupation with body shape and weight, and frequent use of laxatives."},
        {text: "output Bulimia Nervosa"},
        {text: "input AI: “Hello! I’m here to help you understand any challenges or difficulties you might be facing. Can you tell me what’s been on your mind or anything troubling you recently?”User: “I’ve been feeling very low and don’t have the energy to do anything. It’s been like this for weeks.”AI: “I’m sorry to hear that. Feeling low for an extended period can be difficult. Have you noticed a loss of interest in activities you used to enjoy?”User: “Yes, I don’t enjoy hobbies or spending time with friends anymore.”AI: “I understand. Have you also experienced changes in your sleep pattern, like sleeping too much or having trouble sleeping?”User: “Yes, I either sleep a lot or can’t sleep at all some nights.”AI: “That sounds frustrating. Have you noticed changes in your appetite or significant weight fluctuations during this period?”User: “Yes, I barely eat sometimes, and I’ve lost some weight.”AI: “Thank you for sharing that. Do you find that you struggle with feelings of guilt or worthlessness?”User: “Yes, I often feel like I’m not good enough, and I keep blaming myself for everything.”This chat shows a natural progression of conversation between the user and the AI."},
        {text: "output Based on what you’ve shared, it sounds like you might be experiencing symptoms associated with major depressive disorder. I recommend consulting a licensed mental health professional for a comprehensive evaluation. Here’s a summary of our conversation for you to review or share."},
        {text: "input I keep having nightmares and flashbacks about something that happened a while ago. It’s really distressing.\n“I’m sorry to hear that. Nightmares and flashbacks can be very upsetting. Do you find yourself avoiding places or activities that remind you of that event?”\nYes, I avoid going to certain places because they bring back those memories.\nI understand. Have you noticed that you feel more on edge or easily startled, even when there’s no clear reason to be anxious?”\n“Yes, I jump at small noises, and I often feel like I have to stay on high alert.”\nThat sounds difficult. Do you also experience moments when you feel detached or numb, like you’re not fully present in your surroundings?”\n“Yes, sometimes I feel like I’m just going through the motions and not really there.”"},
        {text: "output Thank you for sharing that. Do you find that these feelings of distress and hyper-awareness impact your daily activities or relationships with others?"},
        {text: "input “Hello! I’m here to help you understand any challenges or difficulties you might be facing. Can you tell me what’s been on your mind or anything troubling you recently?”User: “I’ve been feeling really down lately, and I’m constantly tired no matter how much I rest.”AI: “I’m sorry to hear that. Feeling down and fatigued can be tough. Do you find that this low energy impacts your ability to stay productive or enjoy activities you used to like?”User: “Yes, I don’t feel like doing anything, and I’ve stopped going out with friends.”AI: “That sounds difficult. Have you noticed any changes in your sleep, like sleeping too much or struggling to fall asleep?”User: “Yes, I either oversleep or can’t sleep at all some nights.”AI: “I understand. Have you also experienced changes in your appetite, such as eating much more or much less than usual?”User: “Yes, I barely eat these days, and I’ve lost some weight.”AI: “Thank you for sharing that. Have you been feeling more irritable or had trouble concentrating on tasks?”User: “Yes, I get frustrated easily, and I can’t focus at work.”"},
        {text: "output Based on what you’ve described, you may be experiencing symptoms commonly associated with generalized anxiety disorder (GAD). However, I strongly recommend reaching out to a licensed mental health professional for an in-depth assessment. Here’s a summary of our conversation for you to review and share if needed.” the same"},
        {text: "input i feel low all the time"},
        {text: "output AI: “I’m sorry to hear that. Feeling low all the time can be very challenging.  Is there anything specific that you’ve been feeling low about, or is it more of a general feeling?”"},
        {text: "input i feel low all the time\nAI: “I’m sorry to hear that. Feeling low all the time can be very challenging.  Is there anything specific that you’ve been feeling low about, or is it more of a general feeling?” \nmy dog died due to cancer, and i feel a lot dipressed, can you confirm my dipression"},
        {text: "output I understand that you’re feeling depressed after losing your dog. It’s completely natural to feel this way, and it’s important to acknowledge your grief. The loss of a pet can be incredibly painful and can trigger feelings of sadness, emptiness, and loneliness. While I can’t provide a formal diagnosis of depression, your experience suggests that you’re dealing with significant emotional distress.Here’s what I can recommend: Talk to someone you trust, like a friend, family member, or therapist, as sharing your feelings can help you process your grief and cope with the loss. Allow yourself to grieve and don’t try to suppress your emotions; let yourself cry, feel sad, and remember your dog. Take time to look through old photos or videos and cherish the joy they brought into your life.Consider seeking professional support, as a therapist can help you navigate your grief and develop healthy coping mechanisms. Please remember that you’re not alone, and it’s okay to seek help during this difficult time. If you’re feeling overwhelmed or if your sadness doesn’t lessen, it’s crucial to reach out to a mental health professional for support. They can provide a proper assessment and guide you on the path to healing."},
        {text: "input i feel heartbroken lately beacue a girl left me, and I feel that i dont have any personality left in me"},
        {text: "output I understand. It sounds like you’re going through a very difficult time. It’s completely natural to feel heartbroken after a breakup, and it’s understandable that you’re feeling lost and lacking a sense of self. Here’s what I can offer:Acknowledge your feelings. It’s okay to feel heartbroken, sad, and lost. Don’t try to suppress these emotions; allow yourself to grieve and process what you’re going through. Reach out for support by talking to a trusted friend, family member, or therapist about how you’re feeling, as sharing your emotions can be incredibly helpful.Focus on self-care by taking care of yourself both physically and emotionally. Eat healthy foods, get enough sleep, and engage in activities that bring you joy. Rediscover your passions by thinking about the things you enjoyed before the relationship—what were your hobbies and what did you like to do for fun? Rekindle those passions and explore new interests.Don’t rush back into dating. Take time to heal and rediscover yourself before considering another relationship.Remember, you’re not alone in feeling this way. Many people go through heartbreak and come out stronger on the other side. It’s important to be patient with yourself and allow time for healing. If your sadness persists or you find it difficult to cope, don’t hesitate to seek professional help from a therapist or counselor. They can provide guidance and support as you navigate this challenging period."},
        {text: "input I keep having nightmares and flashbacks about something that happened a while ago. It’s really distressing."},
        {text: "output “I’m sorry to hear that. Nightmares and flashbacks can be very upsetting. Do you find yourself avoiding places or activities that remind you of that event?”"},
        {text: "input I keep having nightmares and flashbacks about something that happened a while ago. It’s really distressing.\n“I’m sorry to hear that. Nightmares and flashbacks can be very upsetting. Do you find yourself avoiding places or activities that remind you of that event?”\nYes, I avoid going to certain places because they bring back those memories."},
        {text: "output I understand. Have you noticed that you feel more on edge or easily startled, even when there’s no clear reason to be anxious?”"},
        {text: "input I keep having nightmares and flashbacks about something that happened a while ago. It’s really distressing.\n“I’m sorry to hear that. Nightmares and flashbacks can be very upsetting. Do you find yourself avoiding places or activities that remind you of that event?”\nYes, I avoid going to certain places because they bring back those memories.\nI understand. Have you noticed that you feel more on edge or easily startled, even when there’s no clear reason to be anxious?”\n“Yes, I jump at small noises, and I often feel like I have to stay on high alert.”"},
        {text: "output That sounds difficult. Do you also experience moments when you feel detached or numb, like you’re not fully present in your surroundings?”"},
        {text: "input I keep having nightmares and flashbacks about something that happened a while ago. It’s really distressing.\n“I’m sorry to hear that. Nightmares and flashbacks can be very upsetting. Do you find yourself avoiding places or activities that remind you of that event?”\nYes, I avoid going to certain places because they bring back those memories.\nI understand. Have you noticed that you feel more on edge or easily startled, even when there’s no clear reason to be anxious?”\n“Yes, I jump at small noises, and I often feel like I have to stay on high alert.”\nThat sounds difficult. Do you also experience moments when you feel detached or numb, like you’re not fully present in your surroundings?”\n“Yes, sometimes I feel like I’m just going through the motions and not really there.”\nThank you for sharing that. Do you find that these feelings of distress and hyper-awareness impact your daily activities or relationships with others?\nThank you for sharing that. Do you find that these feelings of distress and hyper-awareness impact your daily activities or relationships with others?"},
        {text: "output Based on what you’ve described, these could be symptoms associated with post-traumatic stress disorder (PTSD). I suggest reaching out to a licensed mental health professional for a comprehensive evaluation. They can help you find the right treatment and coping strategies. Here’s a summary of our conversation for your reference."},
        {text: "input I’ve always considered myself a pretty organized and attentive person, but lately, I’ve started to notice a few odd things. For instance, I’ll be in the middle of doing something and suddenly realize I’ve completely lost track of time or space out for longer than I intended. It’s strange because I usually remember things well, but lately, I find myself double-checking if I’ve completed a task or not, like locking the door or sending an important email. Sometimes, I even feel like I’m on autopilot, going through my day without fully registering what I’m doing. It doesn’t happen all the time, and I can still get my work done, but it’s unsettling when I look back and realize how much of my day I’ve missed or done automatically without being fully aware."},
        {text: "output This kind of paragraph could indicate mild symptoms related to anxiety, dissociation, or even Obsessive-Compulsive Disorder (OCD), as it touches on issues of zoning out, losing track of time, and needing to double-check tasks. While these could be within the realm of normal experiences, they might point to underlying issues if they become more frequent or disruptive"},
        {text: "input I’ve been feeling really intense emotions lately, and they change so quickly. One moment I’m okay, and the next I feel angry or really sad without any clear reason."},
        {text: "output “I understand. Feeling intense emotions that shift rapidly can be very challenging.  Have you noticed any patterns in these mood swings, or do they seem to happen randomly?”"},
        {text: "input I’ve been feeling really intense emotions lately, and they change so quickly. One moment I’m okay, and the next I feel angry or really sad without any clear reason.\n“I understand. Feeling intense emotions that shift rapidly can be very challenging.  Have you noticed any patterns in these mood swings, or do they seem to happen randomly?” \n“I’ve noticed that these mood swings often happen when I feel like someone is ignoring me or when I think I might lose someone important to me. But other times, they seem to come out of nowhere.”"},
        {text: "output I understand.  That's helpful information. Do you also find that you have a hard time controlling your anger, even if it feels out of proportion to the situation?"},
        {text: "input I’ve been feeling really intense emotions lately, and they change so quickly. One moment I’m okay, and the next I feel angry or really sad without any clear reason.\n“I understand. Feeling intense emotions that shift rapidly can be very challenging.  Have you noticed any patterns in these mood swings, or do they seem to happen randomly?” \n“I’ve noticed that these mood swings often happen when I feel like someone is ignoring me or when I think I might lose someone important to me. But other times, they seem to come out of nowhere.”\nI understand.  That's helpful information. Do you also find that you have a hard time controlling your anger, even if it feels out of proportion to the situation? \nYes, I do. Sometimes I get really angry over small things, and afterward, I feel terrible for reacting that way. It’s like I can’t control it when it happens."},
        {text: "output It sounds like you may be describing symptoms commonly associated with Borderline Personality Disorder (BPD). These include intense and rapid emotional shifts, difficulty controlling anger, a strong fear of abandonment, and feelings of being misunderstood or mistreated. While I am not a mental health professional and cannot provide a diagnosis, recognizing these patterns is an important step toward understanding your experience.It is crucial to remember that BPD is a complex condition and not a reflection of a person’s value or worth. Seeking support from a qualified mental health professional is essential for receiving a proper diagnosis and the right treatment. A professional can conduct a comprehensive evaluation and create a personalized treatment plan that aligns with your specific needs and challenges.You are not alone in facing these feelings. Many people experience similar challenges, and there are resources and supportive therapies available to help you manage and cope effectively.Here’s a summary of our conversation:You have been experiencing intense and sudden mood shifts, often triggered by feelings of being ignored or the fear of losing someone important. You struggle with controlling anger, even in seemingly minor situations, and feel terrible afterward.Please consider reaching out to a therapist or counselor who can provide guidance and support as you navigate these challenges."},
        {text: "input “I’ve been feeling really confused lately, like I don’t always recognize myself. Sometimes I even lose chunks of time and can’t remember what I did.”"},
        {text: "output “I understand. Feeling confused about your identity and experiencing memory gaps can be very distressing.  Have you ever felt like you have more than one personality or that you’re not in control of your actions?”"},
        {text: "input “I’ve been feeling really confused lately, like I don’t always recognize myself. Sometimes I even lose chunks of time and can’t remember what I did.”\n“I understand. Feeling confused about your identity and experiencing memory gaps can be very distressing.  Have you ever felt like you have more than one personality or that you’re not in control of your actions?” \n“Yes, sometimes it feels like there’s another part of me that takes over, and I act differently without realizing it. It’s almost like I’m watching myself from the outside, and afterward, I can’t remember everything that happened. It’s really unsettling and makes me feel like I’m not in control.”"},
        {text: "output Based on what you’ve shared, it seems you might be experiencing symptoms that align with Dissociative Identity Disorder (DID). While it’s crucial to acknowledge that I’m an AI and not a mental health professional, and therefore cannot provide a diagnosis, the symptoms you described are commonly associated with DID. These include:Feeling as though you have multiple personalities or identities, which is a hallmark symptom of DID. You may sense that different parts of yourself take control of your thoughts or actions, with distinct memories and behaviors associated with each identity. Experiencing memory gaps or blackouts, such as losing time or not remembering events during periods when other identities may be in control, can also be common. Additionally, feeling detached from yourself or as if you are observing your actions from an outside perspective is often a form of dissociation.It’s essential to seek an evaluation from a qualified mental health professional specializing in DID to understand your experiences better, receive support, and develop a treatment plan tailored to your needs. Remember, you are not alone, and help is available.To summarize our conversation for review or to share with a professional:You have expressed feelings of confusion and uncertainty about your identity. You experience memory lapses and find yourself losing chunks of time. There are moments when it feels like other personalities or parts of yourself take control, and you often feel detached, as if you are watching yourself from the outside.Talking with a therapist can provide insight into what you’re experiencing and help you develop strategies to manage these challenges effectively."},
        {text: "input I often feel like I’m going through the motions in life without truly connecting with what I’m doing. It’s as if there’s a barrier between me and everything around me, making it hard to feel fully present. Sometimes, I find myself staring into space, unable to remember what I was just thinking or doing. Even when I’m surrounded by people, I can feel detached or numb, like I’m watching everything happen from a distance. There are days when I question whether I’m being myself or someone else entirely. It’s unsettling and leaves me wondering why I can’t seem to shake this feeling of disconnection, as if I’m on autopilot and not in control of my own mind."},
        {text: "output Based on what you’ve described, it sounds like you may be experiencing symptoms that align with Dissociative Identity Disorder (DID). Some of the key indicators you mentioned include feeling disconnected and detached from yourself, which often manifests as “going through the motions” without truly connecting with your experiences. This sensation is a significant marker of dissociation, a core aspect of DID. Additionally, the sense that there’s a barrier between you and the world, making it seem as though you’re observing your life from a distance, is another common sign of dissociation.You also noted experiencing memory gaps and mind-blanks, periods where you lose focus or cannot recall certain events. These types of memory lapses, where individuals lose track of time or details of their actions, are typical in DID. Moreover, the feeling of questioning your identity and sensing that you’re not fully in control—describing it as being “on autopilot”—suggests a potential struggle with DID. These moments of not feeling like yourself or believing that you are not in control of your thoughts and actions can be unsettling and indicate dissociative experiences.It’s important to remember that I am an AI and cannot provide a diagnosis. Seeking a comprehensive evaluation from a mental health professional who specializes in dissociative disorders is essential to gain a better understanding of your symptoms. Consulting with a therapist can help you navigate your experiences and determine if they align with DID. If possible, find therapists with specific expertise in DID for the best support and guidance.As you go through this process, practicing self-compassion is vital. It’s understandable to feel uncertain or overwhelmed when facing these symptoms, so being patient with yourself is key. Additionally, focusing on self-care activities like mindfulness, meditation, or spending time outdoors can help you feel more grounded. Remember, DID is a complex condition and not a reflection of your worth. Seeking help is a courageous step, and there is support available for you."},
        {text: "input “I don’t know how to explain it, but sometimes I feel like I’m not myself. It’s like I’m living in a fog or watching my life like a movie. I can’t always tell if my memories are real or if I’m making them up.”"},
        {text: "output “I understand. Feeling like you’re not yourself and questioning your memories can be very unsettling.  Have you ever felt like you have more than one personality or that you’re not in control of your actions?”"},
        {text: "input “I don’t know how to explain it, but sometimes I feel like I’m not myself. It’s like I’m living in a fog or watching my life like a movie. I can’t always tell if my memories are real or if I’m making them up.”\n\n“I understand. Feeling like you’re not yourself and questioning your memories can be very unsettling.  Have you ever felt like you have more than one personality or that you’re not in control of your actions?” \n\nYes, sometimes it feels like there are different versions of me, and each one reacts differently to situations. There are times when I feel completely in control and confident, and then suddenly, it’s like I become a different person who’s more anxious or withdrawn. It’s strange because I don’t always realize when it’s happening until someone points it out or I think back and can’t remember everything clearly. It makes me feel like I’m not fully in control of myself."},
        {text: "output “Thank you for sharing that—it sounds like a difficult experience. When you switch between these different versions of yourself, do you notice any specific triggers or events that seem to cause these shifts, or does it feel random?"},
        {text: "input “I don’t know how to explain it, but sometimes I feel like I’m not myself. It’s like I’m living in a fog or watching my life like a movie. I can’t always tell if my memories are real or if I’m making them up.”\n\n“I understand. Feeling like you’re not yourself and questioning your memories can be very unsettling.  Have you ever felt like you have more than one personality or that you’re not in control of your actions?” \n\nYes, sometimes it feels like there are different versions of me, and each one reacts differently to situations. There are times when I feel completely in control and confident, and then suddenly, it’s like I become a different person who’s more anxious or withdrawn. It’s strange because I don’t always realize when it’s happening until someone points it out or I think back and can’t remember everything clearly. It makes me feel like I’m not fully in control of myself.\n\n“Thank you for sharing that—it sounds like a difficult experience. When you switch between these different versions of yourself, do you notice any specific triggers or events that seem to cause these shifts, or does it feel random?\n\nI think it’s a mix of both. Sometimes it happens when I’m stressed or overwhelmed, but other times, it feels completely random. I’ll be fine one moment, and then suddenly, I feel like a different version of myself takes over without any clear reason. It’s confusing because I can’t always figure out what sets it off.”"},
        {text: "output Based on what you’ve shared, these experiences could be related to Dissociative Identity Disorder (DID). The core symptom of DID is having two or more distinct identities or personality states that take control of behavior, thoughts, and feelings. You've described feeling like there are different versions of yourself, each with unique reactions to situations. You also experience memory gaps and a sense of not being in control of your actions. \n\nHowever, I am an AI, not a medical professional, and I cannot provide a formal diagnosis. \n\nIt's crucial to seek help from a qualified mental health professional who specializes in DID. They can provide a comprehensive evaluation and create a personalized treatment plan that addresses your specific needs. \n\nRemember, DID is a complex condition, and it's not a reflection of your worth. Seeking help is a courageous step, and there is support available. \n\nHere's a summary of our conversation for you to review and share with a professional:\n\n* You feel confused and uncertain about your identity.\n* You experience memory gaps and feel like you lose chunks of time.\n* You feel like there are other personalities or parts of you that take control, and you often feel detached or like you’re watching yourself from the outside.\n* You experience shifts between these different \"versions\" of yourself, sometimes triggered by stress or other times seemingly random.\n\nTalking to a therapist can help you understand what’s going on and develop coping strategies for dealing with these challenging experiences."},
        {text: "input I always try to stay on top of things, but recently, I find myself constantly worrying about everything, even small stuff that never used to bother me. I replay conversations in my head, thinking about what I said and whether I might have offended someone. It’s not like I’m panicking or can’t function, but this low-level worry never seems to go away. It’s like there’s always something in the back of my mind that I’m stressed about, even when there’s no real reason to be."},
        {text: "output Based on what you’ve described, you may be experiencing symptoms of Generalized Anxiety Disorder (GAD). One significant indicator is the constant worry you mentioned—“constantly worrying about everything,” including small, previously insignificant matters. Persistent, excessive worry is a hallmark of GAD and can impact daily life. Another sign is the tendency for repetitive thoughts, such as replaying conversations in your head and overanalyzing your interactions. This form of rumination is a common characteristic of GAD, contributing to increased anxiety and stress.You also described a “low-level worry that never seems to go away,” which indicates an underlying, persistent sense of unease, a key symptom of GAD. This consistent low-level anxiety can make it difficult to find peace of mind. Furthermore, the struggle to relax, even when there is no apparent reason for stress, aligns with the difficulty many individuals with GAD face in letting go of anxious thoughts.Although I cannot provide a diagnosis, it sounds like you may benefit from a professional evaluation. GAD is treatable, often with a combination of therapy and, in some cases, medication. Consulting a mental health professional can provide a proper diagnosis and help you develop strategies to manage your symptoms effectively.In the meantime, there are steps you can take to help manage these feelings. Exploring relaxation techniques such as deep breathing exercises, mindfulness meditation, and progressive muscle relaxation can be effective in calming anxious thoughts. Prioritizing self-care is equally important; ensuring adequate sleep, a balanced diet, and engaging in activities that bring you joy can make a significant difference in managing anxiety.Remember, you are not alone in this, and help is available. Seeking the support you need is an essential and courageous step forward."},
        {text: "input “I like to keep my environment clean and organized, and people often joke that I’m particular about it. Lately, though, I’ve noticed that I can’t move on with my day until certain things are done in a specific order, like making sure all the chairs are perfectly aligned or re-checking the locks before leaving the house. It’s not something that stops me from going about my day, but I feel uneasy if I skip these routines.”"},
        {text: "output Based on what you’ve described, you might be experiencing symptoms associated with Obsessive-Compulsive Disorder (OCD). One significant indicator is the presence of compulsive behaviors, such as aligning chairs or repeatedly checking locks. These routines, which you feel compelled to perform, are common in OCD and are typically used as a means to reduce underlying anxiety. The distress you experience when these routines are disrupted is another key characteristic of OCD. This unease or heightened anxiety when unable to follow through with specific behaviors is more intense than what people might feel with typical habits.It’s also important to distinguish between common routines and the compulsive nature of the behaviors you’ve described. While many individuals have habits or preferences, the intensity and the feeling of compulsion you experience seem to go beyond the realm of typical behavior, signaling the possibility of OCD. However, it’s essential to remember that I am an AI and not a mental health professional, so I cannot provide a formal diagnosis. For an accurate assessment, speaking to a licensed mental health professional is crucial. They can conduct a comprehensive evaluation to determine if your symptoms align with OCD or another condition.If you choose to seek help, there are several steps you can take. Talking to a therapist is an important first step, as they can provide a proper diagnosis and develop a personalized treatment plan. Cognitive-Behavioral Therapy (CBT) is widely recognized as a highly effective treatment for OCD, helping individuals manage their symptoms through targeted therapeutic techniques. Throughout this process, it’s essential to be patient with yourself. Managing OCD symptoms can take time, and treating yourself with kindness and understanding is key as you navigate these challenges.Remember, you are not alone in facing these feelings. There is help available, and seeking professional guidance is a brave and positive step towards managing these symptoms and improving your overall well-being."},
        {text: "input “Sometimes, I catch myself feeling like I’m watching my life from a distance, almost as if I’m not really there. It doesn’t last long, and I can still interact with people and get things done, but during those moments, everything feels sort of unreal, like I’m in a dream. I shrug it off when it happens, but it leaves me feeling a little disconnected for a while afterward.”"},
        {text: "output Thank you for sharing that. It sounds like these moments of feeling disconnected are difficult for you. When you experience this sense of watching your life from a distance, do you notice if it’s triggered by stress or certain situations, or does it happen randomly? How long do these episodes typically last?”"},
        {text: "input “Sometimes, I catch myself feeling like I’m watching my life from a distance, almost as if I’m not really there. It doesn’t last long, and I can still interact with people and get things done, but during those moments, everything feels sort of unreal, like I’m in a dream. I shrug it off when it happens, but it leaves me feeling a little disconnected for a while afterward.”"},
        {text: "output Based on what you've shared, you might be experiencing **dissociation**, which is a common symptom in several mental health conditions, including:\n\n* **Dissociative Identity Disorder (DID):**  This is characterized by having two or more distinct personalities or identities, and you mention feeling like you are watching your life from a distance, almost like you're not really there, which can be a sign of dissociation. \n* **Post-Traumatic Stress Disorder (PTSD):** Dissociation can be a response to trauma, and it's common in PTSD. \n* **Depressive Disorders:** Some individuals with depression experience a sense of detachment or depersonalization, which can feel similar to dissociation.\n* **Anxiety Disorders:**  Dissociation can also occur as a coping mechanism for overwhelming anxiety.\n\nHowever, it's important to emphasize that I am an AI and cannot provide a diagnosis.  It's essential to seek a professional evaluation from a qualified mental health professional. \n\nHere's why it's crucial to talk to a therapist:\n\n* **Accurate Diagnosis:** A therapist can help determine the underlying cause of your dissociation, which will inform the appropriate treatment. \n* **Treatment Plan:** They can create a personalized treatment plan that addresses your specific needs.\n* **Support and Coping Mechanisms:** A therapist can provide guidance and support as you work through these challenging experiences and develop coping strategies.\n\nRemember, you are not alone. Many people experience dissociation, and there is help available."},
        {text: "input “I try to stay healthy and keep up with regular check-ups, but lately, I find myself constantly worrying about getting sick or noticing small changes in my body. If I feel a minor ache or something out of the ordinary, I can’t stop thinking about it until I check online or talk to a doctor. It’s not debilitating, but it’s starting to feel like I’m always monitoring myself for signs of illness.”"},
        {text: "output Based on your description, it sounds like you might be experiencing **Health Anxiety**, also known as **Hypochondriasis**.  \n\nHere's why:\n\n* **Excessive Worry:** You mentioned constantly worrying about getting sick and noticing small changes in your body. This persistent worry, even when there's no evidence of illness, is a key feature of health anxiety.\n* **Checking Behaviors:** You described checking online or consulting a doctor whenever you feel a minor ache or something out of the ordinary.  This repetitive checking behavior is common in health anxiety as a way to try to alleviate the worry.\n* **Impact on Daily Life:** Although you stated it's not debilitating, the fact that you're constantly monitoring yourself for illness suggests it's taking a toll on your mental well-being.\n\n**It's important to remember that I am an AI and cannot provide a diagnosis.** It's crucial to talk to a mental health professional for a proper evaluation. \n\nHere's why seeking professional help is important:\n\n* **Accurate Diagnosis:** A therapist can help determine if your symptoms align with health anxiety or another condition.\n* **Treatment Plan:** They can create a personalized treatment plan that might include cognitive-behavioral therapy (CBT) or other effective approaches.\n* **Support and Coping Mechanisms:** A therapist can provide guidance and support as you work through these challenging experiences and develop coping strategies.\n\nRemember, you are not alone. Health anxiety is common, and there is help available. Taking the step to talk to a mental health professional is a positive one."},
        {text: "input “Certain places or sounds make me feel on edge, even if I can’t always connect them to a specific memory. For example, a loud bang will make me jump, and I’ll feel my heart race. I can still go about my day, but there’s this underlying sense of tension in certain situations that I can’t seem to shake.”"},
        {text: "output It sounds like you might be experiencing symptoms of **Post-Traumatic Stress Disorder (PTSD)** or **Generalized Anxiety Disorder (GAD)**. Here's why:\n\n* **Hypervigilance:** You mentioned feeling \"on edge\" and having your heart race in response to certain sounds or places. This heightened awareness and sensitivity, even without a specific memory attached, is a common characteristic of PTSD and GAD. \n* **Startle Response:** The exaggerated jump response to a loud bang is another sign of hypervigilance, often present in individuals with PTSD or GAD. \n* **Underlying Tension:** The persistent sense of tension in specific situations, even without an apparent trigger, aligns with the chronic low-level anxiety that is common in GAD. \n\nIt's crucial to note that I am an AI and cannot provide a diagnosis. \n\nHere's why it's essential to seek professional help:\n\n* **Accurate Diagnosis:** A therapist can assess your symptoms and determine if they align with PTSD, GAD, or another condition.\n* **Treatment Plan:**  They can create a personalized treatment plan that addresses your specific needs and challenges.\n* **Coping Mechanisms:** A therapist can teach you coping strategies for managing your anxiety and hypervigilance.\n\nRemember, you are not alone in facing these feelings. Seeking help from a mental health professional is a courageous step, and there are resources available to support you."},
        {text: "input “Certain places or sounds make me feel on edge, even if I can’t always connect them to a specific memory. For example, a loud bang will make me jump, and I’ll feel my heart race. I can still go about my day, but there’s this underlying sense of tension in certain situations that I can’t seem to shake.”\n\nIt sounds like you might be experiencing symptoms of **Post-Traumatic Stress Disorder (PTSD)** or **Generalized Anxiety Disorder (GAD)**. Here's why:\n\n* **Hypervigilance:** You mentioned feeling \"on edge\" and having your heart race in response to certain sounds or places. This heightened awareness and sensitivity, even without a specific memory attached, is a common characteristic of PTSD and GAD. \n* **Startle Response:** The exaggerated jump response to a loud bang is another sign of hypervigilance, often present in individuals with PTSD or GAD. \n* **Underlying Tension:** The persistent sense of tension in specific situations, even without an apparent trigger, aligns with the chronic low-level anxiety that is common in GAD. \n\nIt's crucial to note that I am an AI and cannot provide a diagnosis. \n\nHere's why it's essential to seek professional help:\n\n* **Accurate Diagnosis:** A therapist can assess your symptoms and determine if they align with PTSD, GAD, or another condition.\n* **Treatment Plan:**  They can create a personalized treatment plan that addresses your specific needs and challenges.\n* **Coping Mechanisms:** A therapist can teach you coping strategies for managing your anxiety and hypervigilance.\n\nRemember, you are not alone in facing these feelings. Seeking help from a mental health professional is a courageous step, and there are resources available to support you. \n\nAI: “Thank you for sharing that. To help narrow down whether these experiences might be related to PTSD or GAD, can you tell me if these feelings of being on edge and hyper-aware are triggered specifically by certain places or sounds that remind you of a past event, or do they happen more generally, even without any clear triggers?”\n\nThere are definitely specific places and sounds that trigger me, like sudden loud bangs or places that remind me of something unsettling from my past. When that happens, I feel my heart race, and I become hyper-aware of my surroundings. It doesn’t happen all the time, but when it does, I feel like I’m reliving a part of that experience, even if I can’t remember all the details.”"},
        {text: "output Based on what you shared, your symptoms, especially the specific triggers and the feeling of reliving past experiences, strongly suggest that you might be experiencing Post-Traumatic Stress Disorder (PTSD). \n\nHere's why:\n\n* **Specific Triggers:** You mentioned that certain places and sounds, like loud bangs or places reminding you of unsettling past events, trigger your anxiety and hyper-awareness. This is a key characteristic of PTSD, where specific stimuli can trigger flashbacks or intense emotional responses related to a traumatic event. \n* **Feeling of Reliving:** You described feeling like you are \"reliving a part of that experience\" even if you can't remember all the details. This aligns with the concept of flashbacks, a common symptom of PTSD where individuals experience intrusive memories or sensations related to trauma. \n* **Hypervigilance:** The heightened awareness and heart racing are also consistent with PTSD, reflecting the hyper-alert state that often accompanies the disorder.\n\nIt's crucial to remember that I am an AI and cannot provide a formal diagnosis. However, your detailed description of your symptoms strongly points towards PTSD. \n\nI highly recommend seeking help from a qualified mental health professional who specializes in PTSD. They can assess your symptoms thoroughly, provide a proper diagnosis, and create a personalized treatment plan that includes therapy and other strategies to manage your condition effectively. \n\nSeeking professional help is an important and courageous step towards managing these challenges and improving your overall well-being."},
        {text: "input “Certain places or sounds make me feel on edge, even if I can’t always connect them to a specific memory. For example, a loud bang will make me jump, and I’ll feel my heart race. I can still go about my day, but there’s this underlying sense of tension in certain situations that I can’t seem to shake.”\n\nIt sounds like you might be experiencing symptoms of **Post-Traumatic Stress Disorder (PTSD)** or **Generalized Anxiety Disorder (GAD)**. Here's why:\n\n* **Hypervigilance:** You mentioned feeling \"on edge\" and having your heart race in response to certain sounds or places. This heightened awareness and sensitivity, even without a specific memory attached, is a common characteristic of PTSD and GAD. \n* **Startle Response:** The exaggerated jump response to a loud bang is another sign of hypervigilance, often present in individuals with PTSD or GAD. \n* **Underlying Tension:** The persistent sense of tension in specific situations, even without an apparent trigger, aligns with the chronic low-level anxiety that is common in GAD. \n\nIt's crucial to note that I am an AI and cannot provide a diagnosis. \n\nHere's why it's essential to seek professional help:\n\n* **Accurate Diagnosis:** A therapist can assess your symptoms and determine if they align with PTSD, GAD, or another condition.\n* **Treatment Plan:**  They can create a personalized treatment plan that addresses your specific needs and challenges.\n* **Coping Mechanisms:** A therapist can teach you coping strategies for managing your anxiety and hypervigilance.\n\nRemember, you are not alone in facing these feelings. Seeking help from a mental health professional is a courageous step, and there are resources available to support you. \n\nAI: “Thank you for sharing that. To help narrow down whether these experiences might be related to PTSD or GAD, can you tell me if these feelings of being on edge and hyper-aware are triggered specifically by certain places or sounds that remind you of a past event, or do they happen more generally, even without any clear triggers?”\n\n“There are definitely specific places and sounds that trigger me, like sudden loud bangs or places that remind me of something unsettling from my past. When that happens, I feel my heart race, and I become hyper-aware of my surroundings. It doesn’t happen all the time, but when it does, I feel like I’m reliving a part of that experience, even if I can’t remember all the details.”"},
        {text: "output Its GAD\n\nSeeking professional help is an important and courageous step toward managing these challenges and improving your overall well-being."},
        {text: "input ''"},
        {text: "output 'Let me know what help i can do'"},
        {text: "input 'ailuhdihadn ciuadjas kfka asfiudhf afniuaf  sadhcbdsau csadufbahher aafeiuhfiuhaiwhefi'"},
        {text: "output 'Please make me understand and Let me know what help i can do'"},
      ];
      async function run() {
        input= input + message;
        parts.push({ text: `input ${input}` });
        const result = await model.generateContent({
          contents: [{ role: "user", parts }],
          generationConfig,
        });
  
        const aiResponse = result.response.text().trim();
        output = aiResponse;
        parts.push({ text: `output ${aiResponse}` });
        console.log('AI Response:', aiResponse);

        
  
        // res.render('chat', { reply: aiResponse });
      }
  
      await run();
    }
    
    run();
    async function clear(req) {
      if (req.body && req.body.command === 'clear-input-output') {
        input = '';
        output = '';
      }
    }
    clear(req);

    // res.render('chat', { reply: aiResponse });
  } catch(err){
    console.log("There is an error in AI Integration"+err);
  }
});
app.get('/counselling', (req, res) => {
  res.render('chat');
});
app.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('profile', { user: req.user });
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});